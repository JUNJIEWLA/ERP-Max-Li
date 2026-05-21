package com.maxli.usuario.repository;

import com.maxli.usuario.entity.Usuario;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByUsername(String username);

    Optional<Usuario> findByEmail(String email);

    Page<Usuario> findByEstado(String estado, Pageable pageable);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByUsernameAndIdUsuarioNot(String username, Long idUsuario);

    boolean existsByEmailAndIdUsuarioNot(String email, Long idUsuario);
}
