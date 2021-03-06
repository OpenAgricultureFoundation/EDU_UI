import React from 'react';
import {
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem
} from 'reactstrap';

const TIME_WINDOWS = [{ name: 'Past 30 Days', type: 'time-window', durationDays: 30 }]

/**
 * Recipe Runs Dropdown
 *
 * props
 * - userToken (string): Users unique access token.
 * - device (object): Device name, uuid, and registration number. 
 * - onSelectDataset (function): Callback for when a dataset is selected from the dropdown.
 */
export class DatasetsDropdown extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: false,
      dataset: TIME_WINDOWS[0],
      datasets: [TIME_WINDOWS],
    };
    this.fetchDatasets = this.fetchDatasets.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    const { device } = nextProps;
    if (device !== this.props.device) {
      console.log('Received new device:', device);
      this.fetchDatasets(device);
    }
  }

  toggle = () => {
    this.setState(prevState => {
      return { isOpen: !prevState.isOpen };
    });
  };

  onSelectDataset = (event) => {
    const index = event.target.value;
    const { datasets } = this.state;
    const dataset = datasets[index];
    this.setState({ dataset }, () => this.props.onSelectDataset(dataset));
  };

  fetchDatasets(device) {
    console.log('Fetching datasets for device.uuid: ', device.uuid);

    // Initialize time-window datasets
    let datasets = [];
    for (const timeWindow of TIME_WINDOWS) {
      const { name, type, durationDays } = timeWindow;
      const endDate = new Date();
      const date = new Date();
      date.setDate(date.getDate() - 30)
      const startDate = new Date(date);
      const dataset = { name, type, durationDays, startDate, endDate }
      datasets.push(dataset);
    }

    // Verify a device has been selected
    if (device.uuid === null) {
      console.log('No device selected');
      console.log('datasets', datasets);
      const dataset = datasets[0];
      this.setState({ dataset, datasets }, () => this.props.onSelectDataset(dataset));
      return;
    }

    // Get request parameters
    const { userToken } = this.props;

    // Fetch recipe runs from api
    return fetch(process.env.REACT_APP_FLASK_URL + '/api/get_runs/', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        'user_token': userToken,
        'device_uuid': device.uuid,
      })
    })
      .then(async (response) => {

        // Get json response
        const responseJson = await response.json();
        
        // Get response parameters
        const { response_code } = responseJson;
        const runs = responseJson["runs"] || [];

        // Validate response
        if (response_code !== 200 || runs.length === 0) {
          console.log('Did not fetch any new recipe runs');
          console.log('datasets', datasets);
          const dataset = datasets[0];
          this.setState({ dataset, datasets }, () => this.props.onSelectDataset(dataset));
          return;
        }

        // Parse recipe runs
        let prevStartDate = null;
        for (const run of runs) {

          // Get parameters
          const { recipe_name, start, end } = run;

          // Validate recipe name
          if (recipe_name === null || recipe_name === undefined) {
            continue;
          }

          // Validate recipe start
          if (start === null || start === undefined) {
            continue;
          }

          // Initialize recipe run parameters
          const startDate = new Date(Date.parse(start));
          const startDay = startDate.getUTCDate();
          const startMonth = startDate.getUTCMonth() + 1;
          let name = `${recipe_name} (${startMonth}/${startDay}-`;

          // Check for currently running recipes
          let endDate;
          if (end !== null && end !== undefined) {
            endDate = new Date(Date.parse(end));
            const endDay = endDate.getUTCDate();
            const endMonth = endDate.getUTCMonth() + 1;
            name += `${endMonth}/${endDay})`
          } else {
            console.log('Got potential current recipe, name:', name);

            // Check for false current recipes, only the most recent 'current' recipe can 
            // be correct, the older 'current' recipes must come from a data infrastructure 
            // or data reporting bug where a recipe end event message is never stored.
            // To shield the user from this bug, just assume the older 'current' recipes
            // ended when the next recipe started.

            if (prevStartDate === null) { // The latest 'current' recipe (i.e. the correct one)
              name += 'Current)';
              endDate = null;
            } else {
              endDate = prevStartDate;
              const endDay = endDate.getUTCDate();
              const endMonth = endDate.getUTCMonth() + 1;
              name += `${endMonth}/${endDay})`
            }
          }

          // Keep track of previous recipe start date in case of falsly reported 'current' recipe bug
          prevStartDate = startDate;

          // Update recipe runs list
          const type = 'recipe';
          datasets.push({ name, type, startDate, endDate });
        }

        // Update datasets in state
        console.log('datasets:', datasets)
        const dataset = datasets[0];
        this.setState({ dataset, datasets }, () => this.props.onSelectDataset(dataset));
      })
  }

  render() {
    // Get parameters
    const { dataset, datasets } = this.state;

    // Render dropdown
    return (
      <Dropdown isOpen={this.state.isOpen} toggle={this.toggle} >
        <DropdownToggle caret>
          <strong>Dataset: </strong>{dataset.name}
        </DropdownToggle>
        <DropdownMenu>
          <DropdownItem header>Datasets</DropdownItem>
          {datasets.map((dataset, index) =>
            <DropdownItem
              key={index}
              value={index}
              onClick={this.onSelectDataset}>
              {dataset.name}
            </DropdownItem>
          )}
        </DropdownMenu>
      </Dropdown>
    );
  }
}
