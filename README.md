# Aurum ETL Pipeline

Pipeline de datos automatizado que extrae precios de criptomonedas, 
divisas, metales preciosos y petróleo en tiempo real.

## Arquitectura
EventBridge (cada 6h) → Lambda Extract → S3 → Lambda Load → Snowflake → Tableau

## Fuentes de datos
- **Crypto**: CoinGecko API (BTC, ETH, SOL, ADA, XRP)
- **Forex**: ExchangeRate API (EUR, GBP, JPY, CAD, CHF, MXN, BRL)
- **Metales**: Yahoo Finance (XAU, XAG, XPT, XPD)
- **Petróleo**: Yahoo Finance (WTI, Brent)

## Stack tecnológico
- **AWS Lambda** — extracción y carga serverless
- **AWS S3** — staging de datos raw
- **AWS EventBridge** — orquestación y scheduling
- **Snowflake** — data warehouse
- **Tableau** — visualización

## Estructura
- `lambdas/extract/` — extracción de APIs a S3
- `lambdas/load/` — carga de S3 a Snowflake
- `snowflake/` — DDL de tablas y configuración
- `infra/` — configuración de EventBridge

## Vectes (website)
Sitio interactivo en `web/` (React + Vite) publicado en GitHub Pages. Un GitHub Action
(`.github/workflows/deploy.yml`) corre todos los días: extrae un año de historia de
Yahoo Finance y CoinGecko, genera los JSON y despliega el sitio.

- `scripts/clean_pipeline_exports.py` — limpia los exports originales de Snowflake → `data/pipeline/` (una sola vez)
- `scripts/extract_history.py` — descarga la historia de mercado → `data/raw/`
- `scripts/build_web_data.py` — genera los datasets del sitio → `web/public/data/`

Correr localmente:
```bash
pip install -r scripts/requirements.txt
python scripts/extract_history.py
python scripts/build_web_data.py
cd web && npm install && npm run dev
```

## Setup
1. Clona el repositorio
2. Copia `.env.example` a `.env` y completa las variables
3. Crea el bucket S3 y ejecuta `snowflake/setup.sql`
4. Despliega las Lambdas a AWS
5. Configura el trigger de S3 y EventBridge