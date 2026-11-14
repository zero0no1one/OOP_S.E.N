package studyspot;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class MobileCors implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/spots/**")
            .allowedOrigins("https://localhost", "capacitor://localhost")
            .allowedMethods("GET", "POST", "PUT")
            .allowedHeaders("Content-Type");
    }
}
