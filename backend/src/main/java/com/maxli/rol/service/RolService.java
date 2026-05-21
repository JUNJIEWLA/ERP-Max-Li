package com.maxli.rol.service;

import com.maxli.exception.DuplicateResourceException;
import com.maxli.exception.ResourceNotFoundException;
import com.maxli.rol.dto.RolRequestDTO;
import com.maxli.rol.dto.RolResponseDTO;
import com.maxli.rol.entity.Rol;
import com.maxli.rol.mapper.RolMapper;
import com.maxli.rol.repository.RolRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RolService {

    private final RolRepository rolRepository;
    private final RolMapper rolMapper;

    @Transactional(readOnly = true)
    public Page<RolResponseDTO> listar(Pageable pageable) {
        return rolRepository.findAll(pageable).map(rolMapper::toDto);
    }

    @Transactional(readOnly = true)
    public RolResponseDTO buscarPorId(Long id) {
        return rolMapper.toDto(obtenerPorId(id));
    }

    @Transactional
    public RolResponseDTO crear(RolRequestDTO dto) {
        String nombre = dto.getNombre().toUpperCase();
        if (rolRepository.existsByNombre(nombre)) {
            throw new DuplicateResourceException("Ya existe un rol con nombre: " + nombre);
        }
        Rol rol = rolMapper.toEntity(dto);
        return rolMapper.toDto(rolRepository.save(rol));
    }

    @Transactional
    public RolResponseDTO actualizar(Long id, RolRequestDTO dto) {
        Rol rol = obtenerPorId(id);
        String nombre = dto.getNombre().toUpperCase();
        if (rolRepository.existsByNombreAndIdRolNot(nombre, id)) {
            throw new DuplicateResourceException("Ya existe un rol con nombre: " + nombre);
        }
        rol.setNombre(nombre);
        return rolMapper.toDto(rolRepository.save(rol));
    }

    @Transactional
    public void eliminar(Long id) {
        Rol rol = obtenerPorId(id);
        rolRepository.delete(rol);
    }

    public Rol obtenerEntidadPorId(Long id) {
        return obtenerPorId(id);
    }

    private Rol obtenerPorId(Long id) {
        return rolRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Rol no encontrado con id: " + id));
    }
}
