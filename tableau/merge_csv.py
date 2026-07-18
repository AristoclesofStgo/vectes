import pandas as pd
import glob
import os

tableau_dir = r'C:\Portfolio\aurum-etl\tableau'

# Lee cada CSV
crypto  = pd.read_csv(os.path.join(tableau_dir, [f for f in os.listdir(tableau_dir) if 'CRYPTO' in f.upper()][0]))
forex   = pd.read_csv(os.path.join(tableau_dir, [f for f in os.listdir(tableau_dir) if 'FX' in f.upper()][0]))
metals  = pd.read_csv(os.path.join(tableau_dir, [f for f in os.listdir(tableau_dir) if 'METAL' in f.upper()][0]))
oil     = pd.read_csv(os.path.join(tableau_dir, [f for f in os.listdir(tableau_dir) if 'OIL' in f.upper()][0]))

# Agrega columna de categoria y estandariza columnas
crypto['CATEGORIA']     = 'Crypto'
crypto['ACTIVO']        = crypto['SYMBOL']
crypto['PRECIO']        = crypto['CURRENT_PRICE']
crypto['HIGH_24H_STD']  = crypto['HIGH_24H']
crypto['LOW_24H_STD']   = crypto['LOW_24H']
crypto['CAMBIO_PCT_24H']= crypto['PRICE_CHANGE_PCT_24H']
crypto['FECHA']         = crypto['INGESTED_AT']

forex['CATEGORIA']      = 'FX'
forex['ACTIVO']         = forex['QUOTE_CURRENCY']
forex['PRECIO']         = forex['RATE']
forex['HIGH_24H_STD']   = forex['HIGH_24H']
forex['LOW_24H_STD']    = forex['LOW_24H']
forex['CAMBIO_PCT_24H'] = forex['PRICE_CHANGE_PCT_24H']
forex['FECHA']          = forex['INGESTED_AT']

metals['CATEGORIA']     = 'Metales'
metals['ACTIVO']        = metals['SYMBOL']
metals['PRECIO']        = metals['PRICE']
metals['HIGH_24H_STD']  = metals['HIGH_24H']
metals['LOW_24H_STD']   = metals['LOW_24H']
metals['CAMBIO_PCT_24H']= metals['PRICE_CHANGE_PCT_24H']
metals['FECHA']         = metals['INGESTED_AT']

oil['CATEGORIA']        = 'Oil'
oil['ACTIVO']           = oil['SYMBOL']
oil['PRECIO']           = oil['PRICE']
oil['HIGH_24H_STD']     = oil['HIGH_24H']
oil['LOW_24H_STD']      = oil['LOW_24H']
oil['CAMBIO_PCT_24H']   = oil['PRICE_CHANGE_PCT_24H']
oil['FECHA']            = oil['INGESTED_AT']

# Columnas finales estandarizadas
cols = ['CATEGORIA', 'ACTIVO', 'PRECIO', 'HIGH_24H_STD', 
        'LOW_24H_STD', 'CAMBIO_PCT_24H', 'FECHA']

# Une todos
merged = pd.concat([
    crypto[cols],
    forex[cols],
    metals[cols],
    oil[cols]
], ignore_index=True)

# Guarda
output = os.path.join(tableau_dir, 'aurum_merged.csv')
merged.to_csv(output, index=False)
print(f"✅ CSV unificado: {output}")
print(f"📊 Total registros: {len(merged)}")
print(merged['CATEGORIA'].value_counts())