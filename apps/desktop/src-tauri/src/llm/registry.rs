use super::anthropic::AnthropicProvider;
use super::google::GoogleProvider;
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
            ProviderId::DeepSeek => Ok(Box::new(OpenAIProvider::compatible(
                ProviderId::DeepSeek,
                "DeepSeek",
                config.api_key.clone(),
                config.base_url.clone(),
                "https://api.deepseek.com/v1",
            ))),
            ProviderId::Ollama => Ok(Box::new(OpenAIProvider::compatible(
                ProviderId::Ollama,
                "Ollama",
                config.api_key.clone(),
                config.base_url.clone(),
                "http://localhost:11434/v1",
            ))),
            ProviderId::Google => Ok(Box::new(GoogleProvider::new(
                config.api_key.clone(),
                config.base_url.clone(),
            ))),
        }
    }

    /// Get default model for a provider
    pub fn default_model(provider_id: ProviderId) -> &'static str {
        match provider_id {
            ProviderId::Anthropic => "claude-3-5-sonnet-20241022",
            ProviderId::OpenAI => "gpt-4o",
            ProviderId::Google => "gemini-2.5-flash",
            ProviderId::DeepSeek => "deepseek-chat",
            ProviderId::Ollama => "llama3.2",
        }
    }
}

/// Global registry instance (simplified to just be a namespace)
static REGISTRY: std::sync::OnceLock<ProviderFactory> = std::sync::OnceLock::new();

pub fn get_registry() -> &'static ProviderFactory {
    REGISTRY.get_or_init(|| ProviderFactory)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_real_google_provider() {
        let config = LLMConfig {
            provider_id: ProviderId::Google,
            api_key: "test-key".to_string(),
            base_url: None,
            model: None,
        };

        let provider = ProviderFactory::create_provider(&config).expect("google provider");
        assert_eq!(provider.provider_id(), ProviderId::Google);
        assert_eq!(provider.name(), "Google Gemini");
    }

    #[test]
    fn creates_real_ollama_provider() {
        let config = LLMConfig {
            provider_id: ProviderId::Ollama,
            api_key: String::new(),
            base_url: None,
            model: None,
        };

        let provider = ProviderFactory::create_provider(&config).expect("ollama provider");
        assert_eq!(provider.provider_id(), ProviderId::Ollama);
        assert_eq!(provider.name(), "Ollama");
    }
}
