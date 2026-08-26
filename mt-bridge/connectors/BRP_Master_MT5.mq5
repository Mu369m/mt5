// BRP Master MT5 connector: sends normalized trade lifecycle events to the cloud bridge.
// Configure BridgeUrl, ProfileId, and MasterConnectionId in EA inputs.
#property strict

input string BridgeUrl = "http://127.0.0.1:5000/api/copier/profiles/PROFILE_ID/events";
input string ProfileId = "PROFILE_ID";
input string MasterConnectionId = "MASTER_CONNECTION_ID";
input int PollSeconds = 1;

string JsonEscape(const string value) {
   string escaped = value;
   StringReplace(escaped, "\\", "\\\\");
   StringReplace(escaped, "\"", "\\\"");
   return escaped;
}

void SendEvent(const string eventType, const ulong ticket, const string symbol, const double volume, const double price, const double sl, const double tp) {
   string eventId = MasterConnectionId + "-" + (string)ticket + "-" + eventType + "-" + (string)GetTickCount();
   string body = "{\"eventId\":\"" + JsonEscape(eventId) + "\",\"profileId\":\"" + JsonEscape(ProfileId) + "\",\"masterConnectionId\":\"" + JsonEscape(MasterConnectionId) + "\",\"masterTicket\":\"" + (string)ticket + "\",\"eventType\":\"" + eventType + "\",\"symbol\":\"" + JsonEscape(symbol) + "\",\"volumeLots\":" + DoubleToString(volume, 2) + ",\"price\":" + DoubleToString(price, _Digits) + ",\"stopLoss\":" + DoubleToString(sl, _Digits) + ",\"takeProfit\":" + DoubleToString(tp, _Digits) + ",\"occurredAt\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "Z\"}";
   char payload[];
   StringToCharArray(body, payload, 0, WHOLE_ARRAY, CP_UTF8);
   char result[];
   string headers = "Content-Type: application/json\r\n";
   string responseHeaders;
   ResetLastError();
   WebRequest("POST", BridgeUrl, headers, 3000, payload, result, responseHeaders);
}

int OnInit() {
   EventSetTimer(MathMax(1, PollSeconds));
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) { EventKillTimer(); }
void OnTimer() { /* Add terminal event diffing here; keep trade callbacks lightweight. */ }
void OnTradeTransaction(const MqlTradeTransaction &transaction, const MqlTradeRequest &request, const MqlTradeResult &result) {
   if(transaction.type == TRADE_TRANSACTION_DEAL_ADD)
      SendEvent("ORDER_OPEN", transaction.position, transaction.symbol, transaction.volume, transaction.price, 0, 0);
}
