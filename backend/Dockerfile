# ─────────────────────────────────────────────
# ETAPA 1: Compilar con Maven (imagen con JDK completo)
# ─────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS build

# Maven no viene en esta imagen, lo instalamos
RUN apk add --no-cache maven

WORKDIR /app

# Copiar dependencias primero para aprovechar el caché de capas
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copiar el código fuente y compilar (sin tests)
COPY src ./src
RUN mvn clean package -DskipTests -B

# ─────────────────────────────────────────────
# ETAPA 2: Imagen final liviana (solo JRE)
# ─────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Copiar el JAR desde la etapa de compilación
COPY --from=build /app/target/maxli-backend-0.0.1-SNAPSHOT.jar app.jar

# Puerto que expone la aplicación
EXPOSE 8080

# Comando de inicio
ENTRYPOINT ["java", "-jar", "app.jar"]
