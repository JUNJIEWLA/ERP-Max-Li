package com.maxli.config;

/**
 * La configuración CORS está centralizada en SecurityConfig#corsConfigurationSource()
 * para garantizar que Spring Security maneje correctamente las solicitudes OPTIONS
 * (preflight) antes de aplicar las reglas de autorización.
 *
 * Este archivo se mantiene vacío intencionalmente para no duplicar el bean CorsFilter.
 */
