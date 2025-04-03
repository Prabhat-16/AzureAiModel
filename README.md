# CloudSage AI Chat

## Overview

CloudSage AI Chat is a modern, responsive chat interface built with React and Material UI that connects to Azure's AI services. The application provides a sleek, dark-themed interface for interacting with AI models, featuring real-time streaming responses, markdown support, and a user-friendly design.

## Features

- **Modern UI/UX**: Beautiful dark-themed interface with Material UI components
- **Real-time Streaming**: Responses stream in real-time with a typing indicator
- **Markdown Support**: Properly formatted markdown in AI responses (bold, italic, code blocks, lists, etc.)
- **Copy Functionality**: Easy one-click copying of AI responses
- **Responsive Design**: Works on desktop and mobile devices
- **Azure AI Integration**: Connects to Azure AI services for powerful language model capabilities
- **Conversation Management**: Clear conversation history with a single click

## Technology Stack

- **Frontend**: React with TypeScript
- **UI Framework**: Material UI (MUI)
- **Styling**: Emotion for animations and custom styling
- **API Integration**: Azure AI services with streaming support
- **Deployment**: Docker containerization with Nginx

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Docker (for containerized deployment)
- Azure account with AI services access

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd cloudsage-ai-chat
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   REACT_APP_API_BASE_URL=https://your-azure-ai-endpoint
   REACT_APP_API_VERSION=2024-05-01-preview
   REACT_APP_API_KEY=your-api-key
   REACT_APP_MODEL_NAME=DeepSeek-V3
   ```

4. Start the development server:
   ```
   npm start
   ```

## Deployment

### Docker Deployment

1. Build the Docker image:
   ```
   docker build -t cloudsage-ai-chat .
   ```

2. Run the container:
   ```
   docker run -p 80:80 cloudsage-ai-chat
   ```

### Azure Deployment

1. Build the production version:
   ```
   npm run build
   ```

2. Deploy to Azure App Service using Azure CLI:
   ```
   az webapp deployment source config-zip --resource-group <resource-group> --name <app-name> --src build.zip
   ```

## Configuration

The application can be configured by modifying the `API_CONFIG` object in `src/ChatInterface.tsx`:

```typescript
const API_CONFIG = {
  BASE_URL: 'https://your-azure-ai-endpoint',
  API_VERSION: '2024-05-01-preview',
  API_KEY: 'your-api-key',
  MODEL_NAME: 'DeepSeek-V3',
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.8,
  TOP_P: 0.1,
  PRESENCE_PENALTY: 0,
  FREQUENCY_PENALTY: 0
};
```

## Usage

1. Open the application in your web browser
2. Type your message in the input field at the bottom
3. Press Enter or click the Send button
4. View the AI's response as it streams in real-time
5. Use the copy button to copy any response
6. Clear the conversation using the delete button in the header

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
