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
  Tooltip
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { keyframes } from '@emotion/react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// API Configuration
const API_CONFIG = {
  BASE_URL: 'https://prabhat7099545153.services.ai.azure.com/models/chat/completions',
  API_VERSION: '2024-05-01-preview',
  API_KEY: '2SCdM6bGYJZqi5866cIvVeQHheIJxMidTerFZeMMYQSFPxwYd0APJQQJ99BBACHYHv6XJ3w3AAAAACOGJvaN',
  MODEL_NAME: 'DeepSeek-V3',
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.8,
  TOP_P: 0.1,
  PRESENCE_PENALTY: 0,
  FREQUENCY_PENALTY: 0
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
      paper: '#1E293B', // Lighter blue-gray
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
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamingMessage]);

  const processStream = async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
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
                // Handle headers
                .replace(/^#\s+(.*)$/gm, '<h3>$1</h3>')
                .replace(/^##\s+(.*)$/gm, '<h4>$1</h4>')
                // Handle links
                .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
                // Handle line breaks
                .replace(/\n/g, '<br/>');
              
              setCurrentStreamingMessage(prev => {
                // Check if the previous message ends with a list item
                const endsWithListItem = prev.endsWith('</li>');
                // Add proper list tags if needed
                if (content.match(/^\d+\.\s+/) && !endsWithListItem) {
                  return prev + '<ol>' + processedContent;
                } else if (content.match(/^[-*]\s+/) && !endsWithListItem) {
                  return prev + '<ul>' + processedContent;
                } else if (endsWithListItem && !content.match(/^[-*]\s+/) && !content.match(/^\d+\.\s+/)) {
                  return prev + '</ol></ul>' + processedContent;
                }
                return prev + processedContent;
              });
            }
          } catch (e) {
            console.error('Error parsing line:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error reading stream:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCurrentStreamingMessage('');

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}?api-version=${API_CONFIG.API_VERSION}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.API_KEY}`
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          max_tokens: API_CONFIG.MAX_TOKENS,
          temperature: API_CONFIG.TEMPERATURE,
          top_p: API_CONFIG.TOP_P,
          presence_penalty: API_CONFIG.PRESENCE_PENALTY,
          frequency_penalty: API_CONFIG.FREQUENCY_PENALTY,
          model: API_CONFIG.MODEL_NAME,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (reader) {
        await processStream(reader);
        
        if (currentStreamingMessage) {
          setMessages(prev => [...prev, { role: 'assistant', content: currentStreamingMessage }]);
          setCurrentStreamingMessage('');
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setCurrentStreamingMessage('');
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopyTooltip(content);
    setTimeout(() => setCopyTooltip(null), 2000);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ height: '100vh', py: 2 }}>
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          }}
        >
          {/* Header */}
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SmartToyIcon /> CloudSage AI Chat
            </Typography>
            <Tooltip title="Clear conversation">
              <IconButton
                color="error"
                onClick={handleClear}
                disabled={messages.length === 0}
                sx={{ bgcolor: 'background.paper' }}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Messages Area */}
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2, gap: 2, display: 'flex', flexDirection: 'column' }}>
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
                    }}
                  >
                    {message.role === 'user' ? <PersonIcon /> : <SmartToyIcon />}
                  </Avatar>
                  <Paper
                    sx={{
                      p: 2,
                      maxWidth: '80%',
                      bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                      borderRadius: '12px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      position: 'relative',
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
                  <Avatar sx={{ bgcolor: 'secondary.main' }}>
                    <SmartToyIcon />
                  </Avatar>
                  <Paper
                    sx={{
                      p: 2,
                      maxWidth: '80%',
                      bgcolor: 'background.paper',
                      borderRadius: '12px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
                <CircularProgress size={24} />
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input Area */}
          <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
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
                sx={{ minWidth: '120px' }}
              >
                Send
              </Button>
            </Box>
          </Box>
        </Box>
      </Container>
    </ThemeProvider>
  );
};

export default ChatInterface; 