// مزايا المدن (ن8): ما يستدعيه المنطق منها. المباراة الآن بلا ميزة (state.feature = null) فكلها محايدة،
// بقيم js/game/features.js نفسها حين لا ميزة ولا حدث (لا رقم عشوائي يُسحب)
import 'state.dart';

int buildingOwner(MatchState state, String key) => -1;
bool holiTruce(MatchState state, Unit a, Unit b) => false;
bool stormMiss(MatchState state, int pid) => false;
double rangeMul(MatchState state, int pid) => 1;
double stormDamageMul(MatchState state, int pid) => 1;
double featureDamageBonus(MatchState state, int pid) => 0;
List<Object>? pyramidZones(MatchState state) => null;
double pyramidTaken(List<Object> zones, Unit unit) => 1;
List<Object>? statueZones(MatchState state) => null;
bool inZone(List<Object> zones, Unit unit) => false;
double featureSpeedMul(MatchState state, Unit unit) => 1;   // قوس النصر وأحداث المدن
double featureCaptureMul(Object d) => 1;
double featureIncomeMul(MatchState state, int pid) => 1;
double featureProductionMul(MatchState state, int pid) => 1;
double featureCostMul(MatchState state, int pid) => 1;
double eventIncomeMul(MatchState state, Object d) => 1;
double eventCostMul(MatchState state) => 1;
double eventProductionMul(MatchState state) => 1;
void payTax(MatchState state, int payer, double amount) {}
void updateFeatures(MatchState state) {}
