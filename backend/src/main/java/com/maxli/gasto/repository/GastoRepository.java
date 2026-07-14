package com.maxli.gasto.repository;

import com.maxli.gasto.entity.Gasto;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GastoRepository extends JpaRepository<Gasto, Long> {

    boolean existsByOrdenCompra_IdOrdenCompra(Long idOrdenCompra);
}
