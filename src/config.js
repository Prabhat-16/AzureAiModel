const API_CONFIG = {
    BASE_URL: process.env.REACT_APP_AZURE_AI_ENDPOINT,
    API_VERSION: process.env.REACT_APP_AZURE_AI_API_VERSION,
    API_KEY: process.env.REACT_APP_AZURE_AI_API_KEY,
    MODEL_NAME: process.env.REACT_APP_AZURE_AI_MODEL_NAME,
    MAX_TOKENS: parseInt(process.env.REACT_APP_AZURE_AI_MAX_TOKENS || '2048'),
    TEMPERATURE: parseFloat(process.env.REACT_APP_AZURE_AI_TEMPERATURE || '0.5'),
    TOP_P: parseFloat(process.env.REACT_APP_AZURE_AI_TOP_P || '0.9'),
    PRESENCE_PENALTY: parseFloat(process.env.REACT_APP_AZURE_AI_PRESENCE_PENALTY || '0.3'),
    FREQUENCY_PENALTY: parseFloat(process.env.REACT_APP_AZURE_AI_FREQUENCY_PENALTY || '0.2')
  };
  
  // Validate required environment variables
  if (!API_CONFIG.BASE_URL || !API_CONFIG.API_VERSION || !API_CONFIG.API_KEY || !API_CONFIG.MODEL_NAME) {
    console.error('Missing required environment variables for Azure AI configuration');
  }
  
  export default API_CONFIG;
  