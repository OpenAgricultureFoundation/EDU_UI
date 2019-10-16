import React, { Component } from 'react';
import { withCookies } from "react-cookie";
import { Card, Media } from 'reactstrap';
import { RunRecipeModal } from './RunRecipeModal';

const DEFAULT_IMAGE_URL = 'https://cdn.shopify.com/s/files/1/0156/0137/products/refill_0012_basil.jpg?v=1520501227';

class RecipeDetails extends Component {
  constructor(props) {
    super(props);
    this.state = {
      device: { // TODO: This should be currentDevice
        uuid: null,
        name: 'Loading',
      },
      currentRecipe: {
        uuid: null,
        name: 'Loading',
        startDateString: null,
      },
      recipe: {
        uuid: null,
        name: 'Loading',
        description: "Loading",
        author: "Loading",
        method: "Loading",
        imageUrl: DEFAULT_IMAGE_URL,
      },
      wifiStatus: 'Loading',
      showAddDeviceModal: false,
      showRunRecipeModal: false
    };
    // this.getRecipeDetails = this.getRecipeDetails.bind(this);
    // this.handleChange = this.handleChange.bind(this);
  }

  componentDidMount() {
    const recipeUuid = this.props.location.pathname.replace("/recipe_details/", "").replace("#", "");
    this.getRecipeDetails(recipeUuid);
    this.getDeviceStatus();
    this.getCurrentRecipe();
  }

  onSelectDevice = (device) => {
    if (device !== this.state.device) {
      this.setState({ device });
    }
    this.getDeviceStatus(device.uuid);
    this.getCurrentRecipe(device.uuid);
  };

  toggleAddDeviceModal = () => {
    this.setState(prevState => {
      return { showAddDeviceModal: !prevState.showAddDeviceModal }
    });
  }

  toggleRunRecipeModal = () => {
    this.setState(prevState => {
      return { showRunRecipeModal: !prevState.showRunRecipeModal }
    });
  }

  handleChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    });
    event.preventDefault();
  }

  getRecipeDetails(recipeUuid) {
    // Get parameters
    const userToken = this.props.cookies.get('user_token');

    // Request recipe details from api
    return fetch(process.env.REACT_APP_FLASK_URL + "/api/get_recipe_by_uuid/", {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        'user_token': userToken,
        'recipe_uuid': recipeUuid,
      })
    })
      .then(async (response) => {

        // Parse response json
        const responseJson = await response.json();

        // Validate response
        const { response_code } = responseJson;
        if (response_code !== 200) {
          console.error('Unable to get recipe details, received invalid response');
          const recipe = {
            uuid: recipeUuid,
            name: 'Unknown',
            description: 'Unknown',
          }
          this.setState({ recipe });
          return;
        }

        // Get recipe parameters
        const rawRecipe = JSON.parse(responseJson['recipe']) || {};
        console.log('rawRecipe', rawRecipe);
        const recipe = {
          uuid: recipeUuid,
          name: rawRecipe["name"] || "Unknown",
          description: rawRecipe["description"]["verbose"] || rawRecipe["description"]["brief"] || "Unknown",
          author: rawRecipe["authors"][0]["name"] || "Unknown",
          method: rawRecipe["cultivation_methods"][0]["name"] || "Unknown",
          imageUrl: rawRecipe["image_url"] || DEFAULT_IMAGE_URL,
        };

        // Update state
        this.setState({ recipe });
      })
      .catch((error) => {
        console.error('Unable to get recipe details', error);
        // TODO: Update state
        const recipe = {
          uuid: recipeUuid,
          name: 'Unknown',
          description: "Unknown",
          author: "Unknown",
          method: "Unknown",
          imageUrl: DEFAULT_IMAGE_URL,
        }
        this.setState({ recipe });
      });
  }

  // TODO: Include current recipe and environment data
  // TODO: Move this to common code repo js/services
  getDeviceStatus(deviceUuid) {
    // Get parameters
    const userToken = this.props.cookies.get('user_token');

    // Request device status from data api
    return fetch(process.env.REACT_APP_FLASK_URL + '/api/get_current_device_status/', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        'user_token': userToken,
        'device_uuid': deviceUuid,
      })
    })
      .then(async (response) => {

        // Get response json
        const responseJson = await response.json();

        // Get parameters
        const results = responseJson['results'] || {};
        const wifiStatus = results['wifi_status'] || 'Unknown';

        // Update state
        this.setState({ wifiStatus });
      })
      .catch(error => {
        console.error('Unable to get device status', error);
        this.setState({ wifiStatus: 'Unknown' });
      })
  };

  // TODO: This should be included in data from device status endpoint
  // TODO: Make sure recipe uuid is included so we can view a currently running recipe
  // TODO: Move this to common code repo js/services
  getCurrentRecipe(deviceUuid) {
    // Get request parameters
    const userToken = this.props.cookies.get('user_token');

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
        'device_uuid': deviceUuid,
      })
    })
      .then(async (response) => {

        // Parse json response
        const responseJson = await response.json();

        // Get response parameters
        const { response_code } = responseJson;
        const runs = responseJson["runs"] || [];

        // Validate response
        if (response_code !== 200 || runs.length === 0) {
          console.log('Did not fetch any new recipe runs');
          this.setState({ currentRecipe: 'Unknown' })
          return;
        }

        // Get latest recipe run
        const run = runs[0];

        // Get recipe parameters
        const { recipe_name, start, end } = run;

        // Check to see if recipe is currently running
        let name = 'No Recipe';
        let startDateString = null;
        if (end === null) {
          name = recipe_name;
          const startDate = new Date(Date.parse(start));
          startDateString = startDate.toDateString();;
        }

        // Update state
        const currentRecipe = { name, startDateString };
        this.setState({ currentRecipe });
      })
      .catch(error => {
        console.error('Unable to get current recipe', error);
        const currentRecipe = {
          name: 'Unknown',
          startDateString: null,
        };
        this.setState({ currentRecipe });
      })
  }

  render() {
    // Get parameters
    const userToken = this.props.cookies.get('user_token');
    const { device, recipe, currentRecipe, wifiStatus } = this.state;

    // Render component
    return (
      <div>
        <Card style={{ margin: 20 }}>
          <Media>
            <Media left href="#">
              <Media object src={recipe.imageUrl} style={{ maxHeight: 400, maxWidth: 400 }} />
            </Media>
            <Media body style={{ margin: 20 }}>
              <Media heading>{recipe.name}</Media>
              <p>{recipe.description}</p>
              <p>
                <strong>Method:</strong> {recipe.method} <br />
                <strong>Author:</strong> {recipe.author} <br />
              </p>
              <button className="btn btn-secondary" onClick={this.toggleRunRecipeModal}>
                Run this Recipe on your Food Computer
              </button>
            </Media>
          </Media>
        </Card>
        <RunRecipeModal
          userToken={userToken}
          device={device}
          recipe={recipe}
          currentRecipeName={currentRecipe.name}
          wifiStatus={wifiStatus}
          isOpen={this.state.showRunRecipeModal}
          toggle={this.toggleRunRecipeModal}
        />
      </div>
    )
  }
}

export default withCookies(RecipeDetails);

