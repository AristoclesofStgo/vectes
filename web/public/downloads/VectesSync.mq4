//+------------------------------------------------------------------+
//| VectesSync.mq4                                                   |
//| Sends your closed MT4 trades to your Vectes Journal.             |
//| https://aristoclesofstgo.github.io/vectes/                       |
//+------------------------------------------------------------------+
#property copyright   "Vectes"
#property link        "https://aristoclesofstgo.github.io/vectes/"
#property version     "1.00"
#property strict
#property description "Sends every closed trade to your Vectes Journal."
#property description "1. Paste your token from Vectes > Journal > Connect MT4."
#property description "2. Tools > Options > Expert Advisors > Allow WebRequest for:"
#property description "   https://kxzzwenckumkcqymflrx.supabase.co"
#property description "3. Account History tab > right click > All History (for the first sync)."

input string InpToken       = "";   // Vectes token (vx_...)
input int    InpSyncSeconds = 60;   // Check for newly closed trades every N seconds

#define ENDPOINT       "https://kxzzwenckumkcqymflrx.supabase.co/functions/v1/mt4-ingest"
#define ALLOW_URL      "https://kxzzwenckumkcqymflrx.supabase.co"
#define BATCH_SIZE     200
#define HEARTBEAT_SECS 900
#define TIMEOUT_MS     15000

datetime g_lastClose     = 0;     // newest close time (server time) already delivered
int      g_lastTotal     = -1;    // OrdersHistoryTotal() at the last successful sync
datetime g_lastBeat      = 0;     // last successful request (balance heartbeat)
datetime g_retryAt       = 0;     // back-off after a failed request
int      g_failures      = 0;
bool     g_halted        = false; // token rejected: stop until the inputs change
bool     g_started       = false;
string   g_status        = "Starting...";

string KeyLastClose() { return "VectesSync." + IntegerToString(AccountNumber()) + ".lastClose"; }
string KeyOffset()    { return "VectesSync." + IntegerToString(AccountNumber()) + ".offset"; }

//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(InpToken) < 20)
   {
      g_status = "Paste your Vectes token in the EA inputs (F7).";
      ShowStatus();
      return(INIT_PARAMETERS_INCORRECT);
   }
   if(IsTesting())
   {
      g_status = "Vectes Sync does not run in the Strategy Tester.";
      ShowStatus();
      return(INIT_SUCCEEDED);
   }
   if(GlobalVariableCheck(KeyLastClose()))
      g_lastClose = (datetime)GlobalVariableGet(KeyLastClose());
   // First run a couple of seconds after attaching, then on the regular schedule
   EventSetTimer(2);
   ShowStatus();
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment("");
}

void OnTick() {}

void OnTimer()
{
   if(!g_started)
   {
      g_started = true;
      EventKillTimer();
      EventSetTimer(MathMax(10, InpSyncSeconds));
   }
   if(g_halted || IsTesting()) return;
   if(TimeLocal() < g_retryAt) return;
   Sync();
   ShowStatus();
}

//+------------------------------------------------------------------+
//| Server time minus UTC in minutes, rounded to 15 min. On weekends |
//| TimeCurrent() freezes at the last tick, so keep the last good one|
//+------------------------------------------------------------------+
bool ServerOffset(int &offset)
{
   int raw = (int)MathRound((double)(TimeCurrent() - TimeGMT()) / 900.0) * 15;
   if(MathAbs(raw) <= 14 * 60)
   {
      offset = raw;
      GlobalVariableSet(KeyOffset(), offset);
      return(true);
   }
   if(GlobalVariableCheck(KeyOffset()))
   {
      offset = (int)GlobalVariableGet(KeyOffset());
      return(true);
   }
   return(false);
}

string JsonEscape(string s)
{
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return(s);
}

string Num(double value, int digits) { return(DoubleToString(value, digits)); }

string AccountJson(int offset)
{
   return("{\"number\":\"" + IntegerToString(AccountNumber()) + "\"" +
          ",\"broker\":\"" + JsonEscape(AccountCompany()) + "\"" +
          ",\"server\":\"" + JsonEscape(AccountServer()) + "\"" +
          ",\"currency\":\"" + JsonEscape(AccountCurrency()) + "\"" +
          ",\"balance\":" + Num(AccountBalance(), 2) +
          ",\"equity\":" + Num(AccountEquity(), 2) +
          ",\"server_offset_minutes\":" + IntegerToString(offset) + "}");
}

// The selected history order as JSON; times stay in server time, the server converts them
string TradeJson()
{
   int digits = (int)MarketInfo(OrderSymbol(), MODE_DIGITS);
   if(digits <= 0) digits = 5;
   return("{\"ticket\":\"" + IntegerToString(OrderTicket()) + "\"" +
          ",\"symbol\":\"" + JsonEscape(OrderSymbol()) + "\"" +
          ",\"type\":\"" + (OrderType() == OP_BUY ? "buy" : "sell") + "\"" +
          ",\"lots\":" + Num(OrderLots(), 2) +
          ",\"open_time\":" + IntegerToString((long)OrderOpenTime()) +
          ",\"open_price\":" + Num(OrderOpenPrice(), digits) +
          ",\"close_time\":" + IntegerToString((long)OrderCloseTime()) +
          ",\"close_price\":" + Num(OrderClosePrice(), digits) +
          ",\"sl\":" + Num(OrderStopLoss(), digits) +
          ",\"tp\":" + Num(OrderTakeProfit(), digits) +
          ",\"commission\":" + Num(OrderCommission(), 2) +
          ",\"swap\":" + Num(OrderSwap(), 2) +
          ",\"profit\":" + Num(OrderProfit(), 2) + "}");
}

//+------------------------------------------------------------------+
//| POST one payload. Returns the HTTP status, or -1 on a local error|
//+------------------------------------------------------------------+
int Post(string payload, string &response)
{
   char data[], result[];
   string resultHeaders;
   int n = StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, n - 1); // drop the terminating zero
   string headers = "Content-Type: application/json\r\nX-Vectes-Token: " + InpToken + "\r\n";

   ResetLastError();
   int status = WebRequest("POST", ENDPOINT, headers, TIMEOUT_MS, data, result, resultHeaders);
   if(status == -1)
   {
      int err = GetLastError();
      if(err == 4060)
      {
         g_halted = true;
         g_status = "Allow WebRequest for " + ALLOW_URL + " in Tools > Options > Expert Advisors, then re-attach.";
         Alert("Vectes Sync: ", g_status);
      }
      else
         g_status = "Network error " + IntegerToString(err) + ". Retrying...";
      return(-1);
   }
   response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return(status);
}

bool Send(string accountJson, string &trades[], int from, int count)
{
   string items = "";
   for(int k = from; k < from + count; k++)
      items += (k > from ? "," : "") + trades[k];
   string response;
   int status = Post("{\"v\":1,\"account\":" + accountJson + ",\"trades\":[" + items + "]}", response);
   if(status == 200 && StringFind(response, "\"ok\":true") >= 0) return(true);
   if(status == 401 || status == 403)
   {
      g_halted = true;
      g_status = (status == 401)
         ? "Vectes rejected the token. Create a new one in Vectes > Journal and update the EA inputs."
         : "Your Vectes access has expired.";
      Alert("Vectes Sync: ", g_status);
   }
   else if(status > 0)
      g_status = "Vectes returned HTTP " + IntegerToString(status) + ". Retrying...";
   return(false);
}

//+------------------------------------------------------------------+
void Sync()
{
   int offset;
   if(!ServerOffset(offset))
   {
      g_status = "Waiting for a price tick to read the server time...";
      return;
   }

   int total = OrdersHistoryTotal();
   bool heartbeat = TimeLocal() - g_lastBeat >= HEARTBEAT_SECS;
   if(total == g_lastTotal && !heartbeat) return;

   // Closed market orders not yet delivered (re-sending the boundary second is harmless)
   string trades[];
   int count = 0;
   datetime newest = g_lastClose;
   for(int i = 0; i < total; i++)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;
      if(OrderType() != OP_BUY && OrderType() != OP_SELL) continue;
      if(OrderCloseTime() == 0 || OrderCloseTime() < g_lastClose) continue;
      ArrayResize(trades, count + 1, 256);
      trades[count++] = TradeJson();
      if(OrderCloseTime() > newest) newest = OrderCloseTime();
   }

   string accountJson = AccountJson(offset);
   if(count == 0)
   {
      if(!Send(accountJson, trades, 0, 0)) { Fail(); return; }
   }
   for(int from = 0; from < count; from += BATCH_SIZE)
   {
      if(!Send(accountJson, trades, from, MathMin(BATCH_SIZE, count - from))) { Fail(); return; }
   }

   g_lastClose = newest;
   GlobalVariableSet(KeyLastClose(), (double)g_lastClose);
   g_lastTotal = total;
   g_lastBeat = TimeLocal();
   g_failures = 0;
   g_status = (count > 0 ? "Sent " + IntegerToString(count) + " trade(s)." : "Up to date.") +
              " Last sync " + TimeToString(TimeLocal(), TIME_MINUTES);
}

void Fail()
{
   if(g_halted) return;
   g_failures++;
   int wait = (int)MathMin(900, 30 * MathPow(2, MathMin(g_failures - 1, 5)));
   g_retryAt = TimeLocal() + wait;
}

void ShowStatus()
{
   Comment("Vectes Sync - account ", AccountNumber(), "\n", g_status);
}
//+------------------------------------------------------------------+
