use super::anthropic::AnthropicProvider;
use super::openai::OpenAIProvider;
use super::types::*;
use futures_util::Stream;
use std::pin::Pin;

/// LLM Provider trait - defines the interface for all LLM providers
#[async_trait::async_trait]
pub trait LLMProvider: Send + Sync {
    fn name(&self) -> &'static str;
    fn provider_id(&self) -> ProviderId;

    async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, LLMError>;

    async fn stream_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Pin<Box<dyn Stream<Item = StreamEvent> + Send>>;
}

/// Simple provider factory for creating provider instances
pub struct ProviderFactory;

impl ProviderFactory {
    /// Create a provider instance from config
    pub fn create_provider(config: &LLMConfig) -> Result<Box<dyn LLMProvider>, LLMError> {
        match config.provider_id {
            ProviderId::Anthropic => Ok(Box::new(AnthropicProvider::new(
                config.api_key.clone(),
                config.base_url.clone(),
            ))),
            ProviderId::OpenAI => Ok(Box::new(OpenAIProvider::new(
                config.api_key.clone(),
                config.base_url.clone(),
            ))),
            ProviderId::DeepSeek => {
                let base_url = config.base_url.clone().or_else(|| {
                    Some("https://api.deepseek.com/v1".to_string())
                });
                Ok(Box::new(OpenAIProvider::new(
                    config.api_key.clone(),
                    base_url,
                )))
            }
            _ => Ok(Box::new(PlaceholderProvider::new(config.provider_id))),
        }
    }

    /// Get default model for a provider
    pub fn default_model(provider_id: ProviderId) -> &'static str {
        match provider_id {
            ProviderId::Anthropic => "claude-3-5-sonnet-20241022",
            ProviderId::OpenAI => "gpt-4o",
            ProviderId::Google => "gemini-2.0-flash-exp",
            ProviderId::DeepSeek => "deepseek-chat",
            ProviderId::Ollama => "llama3.2",
        }
    }
}

/// Placeholder provider for unimplemented providers
struct PlaceholderProvider {
    id: ProviderId,
}

impl PlaceholderProvider {
    fn new(id: ProviderId) -> Self {
        Self { id }
    }
}

#[async_trait::async_trait]
impl LLMProvider for PlaceholderProvider {
    fn name(&self) -> &'static str {
        match self.id {
            ProviderId::Anthropic => "Anthropic Claude",
            ProviderId::OpenAI => "OpenAI GPT",
            ProviderId::Google => "Google Gemini",
            ProviderId::DeepSeek => "DeepSeek",
            ProviderId::Ollama => "Ollama",
        }
    }

    fn provider_id(&self) -> ProviderId {
        self.id
    }

    async fn chat_completion(
        &self,
        _request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, LLMError> {
        Err(LLMError::UnsupportedOperation(format!(
            "Provider {} is not yet implemented",
            self.name()
        )))
    }

    async fn stream_completion(
        &self,
        _request: ChatCompletionRequest,
    ) -> Pin<Box<dyn Stream<Item = StreamEvent> + Send>> {
        use futures_util::StreamExt;
        futures_util::stream::once(async move {
            StreamEvent::Error {
                message: format!("Provider not implemented"),
            }
        })
        .boxed()
    }
}

/// Global registry instance (simplified to just be a namespace)
static REGISTRY: std::sync::OnceLock<ProviderFactory> = std::sync::OnceLock::new();

pub fn get_registry() -> &'static ProviderFactory {
    REGISTRY.get_or_init(|| ProviderFactory)
}
