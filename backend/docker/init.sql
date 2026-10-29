-- Executado pelo PostgreSQL só na criação do volume (primeiro docker compose up).
-- O banco fhdod (desenvolvimento) já é criado pela variável POSTGRES_DB.
-- O banco fhdod_teste é usado pelos testes automáticos e esvaziado a cada execução.
CREATE DATABASE fhdod_teste OWNER fhdod;
