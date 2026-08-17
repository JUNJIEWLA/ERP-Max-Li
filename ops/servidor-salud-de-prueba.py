#!/usr/bin/env python3
"""Servidor HTTP mínimo que imita las respuestas del backend ante el gate.

Existe solo para ops/verificar-gate-prepiloto.sh: arrancar el Spring Boot real
para comprobar que el gate detecta un readiness caído costaría minutos por
escenario y obligaría a tumbar PostgreSQL a mitad de la prueba. Aquí la
respuesta de cada sonda se controla escribiendo un código de estado en un
archivo, así que un escenario se monta en una línea.

  Uso:  servidor-salud-de-prueba.py <directorio_estado> <archivo_puerto>

En <directorio_estado> se leen —en cada petición, no al arrancar— los archivos:

  liveness   código para GET /actuator/health/liveness   (por omisión 200)
  readiness  código para GET /actuator/health/readiness  (por omisión 200)
  salud      código para GET /actuator/health            (por omisión 200)
  protegida  código para GET /api/productos              (por omisión 401)

El puerto lo elige el sistema (bind a 0) y se escribe en <archivo_puerto>: dos
ejecuciones simultáneas de la suite no pueden chocar por un número fijo.

No forma parte del despliegue. Nada en ops/ lo importa salvo las pruebas.
"""

import http.server
import os
import sys
import threading

RUTAS = {
    "/actuator/health": ("salud", 200),
    "/actuator/health/liveness": ("liveness", 200),
    "/actuator/health/readiness": ("readiness", 200),
    "/api/productos": ("protegida", 401),
}


class Manejador(http.server.BaseHTTPRequestHandler):

    directorio_estado = "."

    def do_GET(self):  # noqa: N802  (nombre impuesto por BaseHTTPRequestHandler)
        ruta = self.path.split("?", 1)[0]
        if ruta not in RUTAS:
            self._responder(404, '{"error":"no encontrado"}')
            return

        archivo, por_omision = RUTAS[ruta]
        self._responder(self._codigo(archivo, por_omision), None)

    def _codigo(self, archivo, por_omision):
        ruta = os.path.join(self.directorio_estado, archivo)
        try:
            with open(ruta, encoding="utf-8") as f:
                return int(f.read().strip())
        except (OSError, ValueError):
            return por_omision

    def _responder(self, codigo, cuerpo):
        if cuerpo is None:
            cuerpo = '{"status":"UP"}' if codigo == 200 else '{"status":"DOWN"}'
        datos = cuerpo.encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(datos)))
        self.end_headers()
        self.wfile.write(datos)

    def log_message(self, *_args):
        """Silencio: el log de la suite lo escribe la suite, no este servidor."""


def main():
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2

    Manejador.directorio_estado = sys.argv[1]
    archivo_puerto = sys.argv[2]

    servidor = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Manejador)
    puerto = servidor.server_address[1]

    # Publicación atómica del puerto: el script que espera este archivo no puede
    # leerlo a medio escribir y quedarse con un número truncado.
    temporal = archivo_puerto + ".parcial"
    with open(temporal, "w", encoding="utf-8") as f:
        f.write(str(puerto))
    os.replace(temporal, archivo_puerto)

    hilo = threading.Thread(target=servidor.serve_forever, daemon=True)
    hilo.start()
    try:
        hilo.join()
    except KeyboardInterrupt:
        servidor.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
