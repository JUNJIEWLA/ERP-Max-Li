package com.maxli.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Set;

@Getter
@AllArgsConstructor
public class LoginResponseDTO {

    private String token;
    private String username;
    private String email;
    private Set<String> roles;
    private long expiresIn; // milisegundos
}
