import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Paper, 
  Typography, 
  CircularProgress,
  IconButton,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Avatar,
  Fade,
  Container,
  Tooltip,
  Snackbar,
  Alert
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import { keyframes } from '@emotion/react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// API Configuration - Using environment variables
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

// System message to guide the AI's behavior - More specific instructions
const SYSTEM_MESSAGE: Message = {
  role: 'system',
  content: 'You are CloudSage AI, a helpful and knowledgeable assistant. Provide clear, concise, and accurate responses. Focus on answering the user\'s question directly without unnecessary elaboration. If you don\'t know something, admit it. Use markdown formatting for better readability.'
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7C3AED', // Purple
    },
    secondary: {
      main: '#10B981', // Emerald
    },
    background: {
      default: '#0F172A', // Dark blue-gray
      paper: 'rgba(30, 41, 59, 0.8)', // Lighter blue-gray with transparency
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          textTransform: 'none',
          padding: '10px 20px',
          fontWeight: 500,
          boxShadow: '0 4px 14px 0 rgba(124, 58, 237, 0.39)',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 20px 0 rgba(124, 58, 237, 0.5)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(124, 58, 237, 0.5)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#7C3AED',
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
  },
});

const blinkingCursor = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0; }
  100% { opacity: 1; }
`;

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState('');
  const [copyTooltip, setCopyTooltip] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // const [isInitialized, setIsInitialized] = useState(false);
  const streamingMessageRef = useRef('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamingMessage]);

  // Cleanup function to abort any ongoing requests when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const processStream = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    try {
      let buffer = '';
      streamingMessageRef.current = ''; // Reset the streaming message reference
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        buffer += chunk;
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.trim() === 'data: [DONE]') continue;
          
          try {
            const cleanedLine = line.replace(/^data: /, '');
            const parsed = JSON.parse(cleanedLine);
            if (parsed.choices[0].delta?.content) {
              const content = parsed.choices[0].delta.content;
              // Enhanced markdown processing
              const processedContent = content
                // Handle bold text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                // Handle italic text
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                // Handle inline code
                .replace(/`(.*?)`/g, '<code>$1</code>')
                // Handle code blocks with language
                .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
                // Handle numbered lists
                .replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>')
                // Handle bullet points
                .replace(/^[-*]\s+(.*)$/gm, '<li>$1</li>')
                // Handle # being used as bullet points
                .replace(/^#\s+(?!\s*#)(.*)$/gm, '<li>$1</li>')
                // Handle headers - improved to handle multiple levels
                .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
                .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
                .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
                .replace(/^####\s+(.*)$/gm, '<h4>$1</h4>')
                .replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>')
                .replace(/^######\s+(.*)$/gm, '<h6>$1</h6>')
                // Handle links
                .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
                // Handle line breaks
                .replace(/\n/g, '<br/>');
              
              // Update both the ref and the state
              streamingMessageRef.current += processedContent;
              setCurrentStreamingMessage(streamingMessageRef.current);
            }
          } catch (e) {
            console.error('Error parsing line:', e, 'Line:', line);
          }
        }
      }
      
      // After the stream is complete, ensure the final message is added
      if (streamingMessageRef.current) {
        console.log('Stream complete, final message:', streamingMessageRef.current);
      }
    } catch (error) {
      console.error('Error reading stream:', error);
      throw error;
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCurrentStreamingMessage('');
    setErrorMessage(null);
    streamingMessageRef.current = ''; // Reset the streaming message reference
    
    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();
    // const signal = abortControllerRef.current.signal;

    try {
      // Prepare messages array with system message if this is the first message
      const messageArray = messages.length === 0 
        ? [SYSTEM_MESSAGE, userMessage] 
        : [...messages, userMessage];
      
      console.log('Sending request to API with messages:', messageArray);
      
      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(`${API_CONFIG.BASE_URL}?api-version=${API_CONFIG.API_VERSION}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.API_KEY}`
        },
        body: JSON.stringify({
          messages: messageArray,
          max_tokens: API_CONFIG.MAX_TOKENS,
          temperature: API_CONFIG.TEMPERATURE,
          top_p: API_CONFIG.TOP_P,
          presence_penalty: API_CONFIG.PRESENCE_PENALTY,
          frequency_penalty: API_CONFIG.FREQUENCY_PENALTY,
          model: API_CONFIG.MODEL_NAME,
          stream: true
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (reader) {
        await processStream(reader);
        
        // After the stream is complete, add the final message to the messages array
        if (streamingMessageRef.current) {
          console.log('Adding final message to chat:', streamingMessageRef.current);
          setMessages(prev => [...prev, { role: 'assistant', content: streamingMessageRef.current }]);
          setCurrentStreamingMessage('');
          // Reset retry count on successful response
          setRetryCount(0);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      
      // Check if the error is due to abort
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('Request was aborted');
        setErrorMessage('Request timed out. Please try again.');
        return;
      }
      
      // Handle network errors or API errors
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrorMessage(`Error: ${errorMsg}`);
      
      // Add error message to chat
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request. Please try again.' 
      }]);
      
      // Implement retry logic
      if (retryCount < 2) {
        setRetryCount(prev => prev + 1);
        console.log(`Retrying request (attempt ${retryCount + 1}/3)...`);
        setTimeout(() => {
          handleSend();
        }, 2000);
      } else {
        setRetryCount(0);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleClear = () => {
    setMessages([]);
    setCurrentStreamingMessage('');
    streamingMessageRef.current = ''; // Reset the streaming message reference
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopyTooltip(content);
    setTimeout(() => setCopyTooltip(null), 2000);
  };

  const handleRetry = () => {
    if (messages.length > 0) {
      // Remove the last assistant message if it was an error
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && lastMessage.content.includes('Sorry, I encountered an error')) {
        setMessages(prev => prev.slice(0, -1));
      }
      // Retry the last user message
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMessage) {
        setInput(lastUserMessage.content);
        setTimeout(() => {
          handleSend();
        }, 100);
      }
    }
  };

  const handleCloseError = () => {
    setErrorMessage(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          width: '100%',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%237C3AED' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            opacity: 0.5,
            zIndex: 0,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.1) 0%, rgba(16, 185, 129, 0.05) 50%, rgba(15, 23, 42, 0) 100%)',
            zIndex: 1,
          },
        }}
      >
        {/* Floating elements for futuristic effect */}
        <Box
          sx={{
            position: 'absolute',
            top: '10%',
            left: '5%',
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.2) 0%, rgba(124, 58, 237, 0) 70%)',
            filter: 'blur(20px)',
            zIndex: 1,
            animation: 'float 15s ease-in-out infinite',
            '@keyframes float': {
              '0%': { transform: 'translate(0, 0) rotate(0deg)' },
              '50%': { transform: 'translate(20px, 20px) rotate(180deg)' },
              '100%': { transform: 'translate(0, 0) rotate(360deg)' },
            },
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '10%',
            right: '5%',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0) 70%)',
            filter: 'blur(20px)',
            zIndex: 1,
            animation: 'float 20s ease-in-out infinite reverse',
            '@keyframes float': {
              '0%': { transform: 'translate(0, 0) rotate(0deg)' },
              '50%': { transform: 'translate(20px, 20px) rotate(180deg)' },
              '100%': { transform: 'translate(0, 0) rotate(360deg)' },
            },
          }}
        />
        
        <Container maxWidth="md" sx={{ height: '100vh', py: 2, position: 'relative', zIndex: 2 }}>
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.paper',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              position: 'relative',
              backdropFilter: 'blur(10px)',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #7C3AED, #10B981)',
              },
            }}
          >
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ width: '40px' }} /> {/* Spacer for balance */}
              <Typography 
                variant="h5" 
                sx={{ 
                  color: 'primary.main', 
                  fontWeight: 700, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  textAlign: 'center',
                  background: 'linear-gradient(90deg, #7C3AED, #10B981)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '0.5px',
                }}
              >
                <SmartToyIcon sx={{ fontSize: '1.5rem' }} /> CloudSagee AI
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Retry last message">
                  <IconButton
                    color="primary"
                    onClick={handleRetry}
                    disabled={messages.length === 0 || isLoading}
                    sx={{ 
                      bgcolor: 'background.paper',
                      '&:hover': {
                        bgcolor: 'rgba(124, 58, 237, 0.1)',
                      }
                    }}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Clear conversation">
                  <IconButton
                    color="error"
                    onClick={handleClear}
                    disabled={messages.length === 0}
                    sx={{ 
                      bgcolor: 'background.paper',
                      '&:hover': {
                        bgcolor: 'rgba(239, 68, 68, 0.1)',
                      }
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Messages Area */}
            <Box 
              sx={{ 
                flexGrow: 1, 
                overflow: 'auto', 
                p: 2, 
                gap: 2, 
                display: 'flex', 
                flexDirection: 'column',
                background: 'radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)',
              }}
            >
              {messages.map((message, index) => (
                <Fade in={true} key={index} timeout={500}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 2,
                      flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                    }}
                  >
                    <Avatar
                      sx={{
                        bgcolor: message.role === 'user' ? 'primary.main' : 'secondary.main',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        width: 40,
                        height: 40,
                      }}
                    >
                      {message.role === 'user' ? <PersonIcon /> : <SmartToyIcon />}
                    </Avatar>
                    <Paper
                      sx={{
                        p: 2,
                        maxWidth: '80%',
                        bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                        borderRadius: '16px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        position: 'relative',
                        border: message.role === 'assistant' ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        '&::before': message.role === 'assistant' ? {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '2px',
                          background: 'linear-gradient(90deg, #7C3AED, #10B981)',
                          borderRadius: '16px 16px 0 0',
                        } : {},
                      }}
                    >
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          '& strong': { color: message.role === 'user' ? 'white' : 'primary.main' },
                          '& em': { fontStyle: 'italic' },
                          '& code': { 
                            fontFamily: 'monospace',
                            bgcolor: 'rgba(0,0,0,0.2)',
                            p: 0.5,
                            borderRadius: '4px',
                          },
                          '& pre': {
                            bgcolor: 'rgba(0,0,0,0.2)',
                            p: 2,
                            borderRadius: '8px',
                            overflow: 'auto',
                            '& code': {
                              display: 'block',
                              whiteSpace: 'pre',
                            },
                          },
                          '& ol, & ul': {
                            pl: 3,
                            mb: 1,
                            '& li': {
                              mb: 0.5,
                            },
                          },
                          '& h1': {
                            fontSize: '1.75rem',
                            fontWeight: 700,
                            mb: 1.5,
                            color: 'primary.main',
                          },
                          '& h2': {
                            fontSize: '1.5rem',
                            fontWeight: 600,
                            mb: 1.25,
                            color: 'primary.main',
                          },
                          '& h3': {
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            mb: 1,
                            color: 'primary.main',
                          },
                          '& h4': {
                            fontSize: '1.1rem',
                            fontWeight: 500,
                            mb: 1,
                            color: 'primary.main',
                          },
                          '& h5, & h6': {
                            fontSize: '1rem',
                            fontWeight: 500,
                            mb: 0.75,
                            color: 'primary.main',
                          },
                          '& a': {
                            color: 'primary.main',
                            textDecoration: 'none',
                            '&:hover': {
                              textDecoration: 'underline',
                            },
                          },
                        }}
                        dangerouslySetInnerHTML={{ __html: message.content }}
                      />
                      {message.role === 'assistant' && (
                        <Tooltip title={copyTooltip === message.content ? 'Copied!' : 'Copy message'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopy(message.content)}
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              opacity: 0.5,
                              '&:hover': { opacity: 1 },
                            }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Paper>
                  </Box>
                </Fade>
              ))}
              
              {/* Streaming message */}
              {currentStreamingMessage && (
                <Fade in={true} timeout={500}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'secondary.main', width: 40, height: 40 }}>
                      <SmartToyIcon />
                    </Avatar>
                    <Paper
                      sx={{
                        p: 2,
                        maxWidth: '80%',
                        bgcolor: 'background.paper',
                        borderRadius: '16px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '2px',
                          background: 'linear-gradient(90deg, #7C3AED, #10B981)',
                          borderRadius: '16px 16px 0 0',
                        },
                      }}
                    >
                      <Typography 
                        variant="body1"
                        sx={{ 
                          '& strong': { color: 'primary.main' },
                          '& em': { fontStyle: 'italic' },
                          '& code': { 
                            fontFamily: 'monospace',
                            bgcolor: 'rgba(0,0,0,0.2)',
                            p: 0.5,
                            borderRadius: '4px',
                          },
                          '& pre': {
                            bgcolor: 'rgba(0,0,0,0.2)',
                            p: 2,
                            borderRadius: '8px',
                            overflow: 'auto',
                            '& code': {
                              display: 'block',
                              whiteSpace: 'pre',
                            },
                          },
                          '& h1': {
                            fontSize: '1.75rem',
                            fontWeight: 700,
                            mb: 1.5,
                            color: 'primary.main',
                          },
                          '& h2': {
                            fontSize: '1.5rem',
                            fontWeight: 600,
                            mb: 1.25,
                            color: 'primary.main',
                          },
                          '& h3': {
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            mb: 1,
                            color: 'primary.main',
                          },
                          '& h4': {
                            fontSize: '1.1rem',
                            fontWeight: 500,
                            mb: 1,
                            color: 'primary.main',
                          },
                          '& h5, & h6': {
                            fontSize: '1rem',
                            fontWeight: 500,
                            mb: 0.75,
                            color: 'primary.main',
                          },
                          '& ol, & ul': {
                            pl: 3,
                            mb: 1,
                            '& li': {
                              mb: 0.5,
                            },
                          },
                        }}
                        dangerouslySetInnerHTML={{ __html: currentStreamingMessage }}
                      />
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-block',
                          width: '4px',
                          height: '20px',
                          bgcolor: 'primary.main',
                          ml: 0.5,
                          animation: `${blinkingCursor} 1s step-end infinite`,
                        }}
                      />
                    </Paper>
                  </Box>
                </Fade>
              )}

              {isLoading && !currentStreamingMessage && (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={24} sx={{ color: 'primary.main' }} />
                </Box>
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Input Area */}
            <Box 
              sx={{ 
                p: 2, 
                bgcolor: 'background.paper', 
                borderTop: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type your message..."
                  multiline
                  maxRows={4}
                  disabled={isLoading}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'background.default',
                    },
                  }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  endIcon={<SendIcon />}
                  sx={{ 
                    minWidth: '120px',
                    background: 'linear-gradient(90deg, #7C3AED, #10B981)',
                    '&:hover': {
                      background: 'linear-gradient(90deg, #6D28D9, #059669)',
                    },
                  }}
                >
                  Send
                </Button>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>
      
      {/* Error Snackbar */}
      <Snackbar 
        open={!!errorMessage} 
        autoHideDuration={6000} 
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
};

export default ChatInterface; 