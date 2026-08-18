package com.maxli.venta.controller;

import com.maxli.venta.dto.DashboardStatsDTO;
import com.maxli.venta.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/stats")
    public ResponseEntity<DashboardStatsDTO> obtenerStats() {
        return ResponseEntity.ok(dashboardService.obtenerStats());
    }
}
