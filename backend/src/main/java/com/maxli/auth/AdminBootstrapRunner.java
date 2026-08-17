package com.maxli.auth;

import com.maxli.auth.service.AdminBootstrapService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Dispara el bootstrap de la credencial administrativa tras el arranque, ya con
 * las migraciones de Flyway aplicadas.
 *
 * <p>Si {@link AdminBootstrapService} decide abortar —producción sin credencial
 * segura— la excepción se propaga desde aquí y la aplicación no queda arriba.
 */
@Component
@RequiredArgsConstructor
public class AdminBootstrapRunner implements ApplicationRunner {

    private final AdminBootstrapService adminBootstrapService;

    @Override
    public void run(ApplicationArguments args) {
        adminBootstrapService.ejecutar();
    }
}
