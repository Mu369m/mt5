// BRP Master MT4 connector: sends normalized lifecycle events to the cloud bridge.
// Add BridgeUrl, ProfileId, and MasterConnectionId as EA inputs before attaching.
#property strict

extern string BridgeUrl = "http://127.0.0.1:5000/api/copier/profiles/PROFILE_ID/events";
extern string ProfileId = "PROFILE_ID";
extern string MasterConnectionId = "MASTER_CONNECTION_ID";
extern int PollSeconds = 1;

string JsonEscape(string value) {
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   return value;
}

void SendEvent(string eventType, int ticket, string symbol, double volume, double price, double sl, double tp) {
   string eventId = MasterConnectionId + "-" + IntegerToString(ticket) + "-" + eventType + "-" + IntegerToString(GetTickCount());
   string body = "{\"eventId\":\"" + JsonEscape(eventId) + "\",\"profileId\":\"" + JsonEscape(ProfileId) + "\",\"masterConnectionId\":\"" + JsonEscape(MasterConnectionId) + "\",\"masterTicket\":\"" + IntegerToString(ticket) + "\",\"eventType\":\"" + eventType + "\",\"symbol\":\"" + JsonEscape(symbol) + "\",\"volumeLots\":" + DoubleToString(volume, 2) + ",\"price\":" + DoubleToString(price, Digits) + ",\"stopLoss\":" + DoubleToString(sl, Digits) + ",\"takeProfit\":" + DoubleToString(tp, Digits) + ",\"occurredAt\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "Z\"}";
   char payload[];
   StringToCharArray(body, payload, 0, WHOLE_ARRAY);
   char result[];
   string responseHeaders;
   WebRequest("POST", BridgeUrl, "Content-Type: application/json\r\n", 3000, payload, result, responseHeaders);
}

int init() { EventSetTimer(MathMax(1, PollSeconds)); return(0); }
int deinit() { EventKillTimer(); return(0); }
void OnTimer() { /* Add order-diff tracking here; never block tick processing. */ }

void OnTick() {
   static int lastTicket = -1;
   for(int index = OrdersHistoryTotal() - 1; index >= 0; index--) {
      if(!OrderSelect(index, SELECT_BY_POS, MODE_HISTORY)) continue;
      if(OrderTicket() == lastTicket) break;
      lastTicket = OrderTicket();
      SendEvent("ORDER_CLOSE", OrderTicket(), OrderSymbol(), OrderLots(), OrderClosePrice(), OrderStopLoss(), OrderTakeProfit());
      break;
   }
}
