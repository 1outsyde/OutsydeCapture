import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import { convertTo12Hour } from "@/components/HoursEditor";
import { mapProviderBlockToBlockedDate } from "@/utils/availabilityUtils";
import { CalendarBooking, CalendarBlockedDate } from "@/components/ProviderCalendar";

const BG = "#0F0F0F";
const GOLD = "#C9933A";
const CREAM = "#F0EAD6";
const CREAM_DIM = "rgba(200,191,168,0.6)";
const GREEN = "#3FCB6E";
const AMBER = "#E0A93B";
const RED = "#E85D5D";
const SURFACE = "#1A1A1A";
const SURFACE2 = "#1E1E1E";
const BORDER = "rgba(255,255,255,0.06)";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const WEEKDAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// Photographers shoot at sunrise and sunset, so this spans 6 AM – 9 PM rather
// than the 8–17 the business calendar uses. Anything outside this range does
// not render in day or week view.
const HOURS = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];
const HOUR_LABELS: Record<number,string> = {
  6:"6 AM",7:"7 AM",8:"8 AM",9:"9 AM",10:"10 AM",11:"11 AM",12:"12 PM",
  13:"1 PM",14:"2 PM",15:"3 PM",16:"4 PM",17:"5 PM",
  18:"6 PM",19:"7 PM",20:"8 PM",21:"9 PM",
};

type ViewMode = "day" | "week" | "list";

// The backend enum has nine states (shared/schema.ts:123-133). pending_provider
// means "awaiting provider accept/decline" and is treated as pending throughout
// this screen — amber, and counted in pending totals.
function isPendingStatus(status: string): boolean {
  return status === "pending" || status === "pending_provider";
}

function statusLabel(status: string): string {
  if (status === "pending_provider") return "Pending Review";
  if (status === "no_show") return "No Show";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function parseHour(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 9;
  let h = parseInt(match[1]);
  const period = match[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function getWeekDays(dateStr: string): string[] {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(sunday);
    dd.setDate(sunday.getDate() + i);
    return `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,"0")}-${String(dd.getDate()).padStart(2,"0")}`;
  });
}

function getMonthGrid(year: number, month: number): Array<string | null> {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells: Array<string | null> = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatMonthDay(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  return `${MONTHS[parts[1]-1]} ${parts[2]}`;
}

function statusBg(status: string): string {
  if (status === "confirmed") return "#1a2e1a";
  if (isPendingStatus(status)) return "#2a2218";
  return "#2a1818";
}
function statusBorder(status: string): string {
  if (status === "confirmed") return GREEN;
  if (isPendingStatus(status)) return AMBER;
  return RED;
}
function statusPill(status: string): { bg: string; text: string } {
  if (status === "confirmed") return { bg: "rgba(63,203,110,0.15)", text: GREEN };
  if (isPendingStatus(status)) return { bg: "rgba(224,169,59,0.15)", text: AMBER };
  if (status === "completed") return { bg: "rgba(201,147,58,0.15)", text: GOLD };
  if (status === "cancelled" || status === "declined") return { bg: "rgba(232,93,93,0.1)", text: RED };
  if (status === "expired" || status === "no_show") return { bg: "rgba(255,255,255,0.08)", text: CREAM_DIM };
  return { bg: "rgba(255,255,255,0.08)", text: CREAM_DIM };
}

export default function PhotographerCalendarScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { getToken } = useAuth();

  const today = todayISO();
  const now = new Date();

  const [selectedDay, setSelectedDay] = useState(today);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [dispYear, setDispYear] = useState(now.getFullYear());
  const [dispMonth, setDispMonth] = useState(now.getMonth());

  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [blockedDates, setBlockedDates] = useState<CalendarBlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    const [bookingsResult, blocksResult] = await Promise.allSettled([
      api.getPhotographerMeBookings(token),
      api.getBlocks(token, "photographer"),
    ]);

    if (bookingsResult.status === "fulfilled") {
      const raw: any = bookingsResult.value;
      const rows: any[] = Array.isArray(raw) ? raw : raw?.bookings ?? [];
      setBookings(rows.map((b: any) => {
        // bookingDateTime is `${date} ${startTime}` (server/storage.ts:1635) and
        // can carry seconds. convertTo12Hour matches strictly on ^HH:mm$ and
        // returns its input unchanged on failure, which would then make
        // parseHour fall back to 9 and bucket every booking at 9 AM — so
        // truncate to HH:mm before converting.
        const bookingDateTime: string = b.bookingDateTime || "";
        const datePart = b.date || bookingDateTime.split(" ")[0] || "";
        const rawTime = b.startTime || b.time || bookingDateTime.split(" ")[1] || "";
        const startTime = rawTime ? convertTo12Hour(rawTime.substring(0, 5)) : "9:00 AM";

        const firstName = b.firstName || "";
        const lastName = b.lastName || "";
        const clientName =
          b.clientName ||
          b.customerName ||
          (firstName || lastName ? `${firstName} ${lastName}`.trim() : "Client");

        // totalPaid is integer CENTS (server/storage.ts:1636). The dashboard
        // mapper at PhotographerDashboardScreen.tsx:301-303 claims dollars and
        // does not divide — that is a known bug scheduled for a separate build.
        // This screen is the correct one.
        const amountCents =
          typeof b.totalPaid === "number" ? b.totalPaid
          : typeof b.totalAmount === "number" ? b.totalAmount
          : 0;

        return {
          id: b.recordId || b.id || "",
          date: datePart,
          startTime,
          endTime: undefined,
          clientName,
          serviceName: b.serviceName || b.shootType || b.sessionType || "Session",
          status: (b.status || "pending") as CalendarBooking["status"],
          amount: amountCents / 100,
        };
      }));
    }

    if (blocksResult.status === "fulfilled") {
      const raw: any = blocksResult.value;
      const rows: any[] = Array.isArray(raw) ? raw : raw?.blocks ?? [];
      setBlockedDates(
        rows
          .map(mapProviderBlockToBlockedDate)
          .filter((b): b is NonNullable<typeof b> => b !== null)
      );
    }

    setLoading(false);
    setRefreshing(false);
  }, [getToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBlockDate = async (date: string, isFullDay: boolean, startTime?: string, endTime?: string, reason?: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      const startAt = isFullDay ? `${date}T00:00:00` : `${date}T${startTime}:00`;
      const endAt = isFullDay ? `${date}T23:59:59` : `${date}T${endTime}:00`;
      const newBlock = await api.createBlock(token, "photographer", { startAt, endAt, reason } as any);
      setBlockedDates(prev => [...prev, { id: newBlock.id, date, isFullDay, startTime: isFullDay ? undefined : startTime, endTime: isFullDay ? undefined : endTime, reason }]);
    } catch (err) { console.error("[PhotographerCalendar] Failed to block:", err); }
  };

  const handleUnblockDate = async (blockId: string) => {
    const token = await getToken();
    if (!token) return;
    try {
      await api.deleteBlock(token, "photographer", blockId);
      setBlockedDates(prev => prev.filter(b => b.id !== blockId));
    } catch (err) { console.error("[PhotographerCalendar] Failed to unblock:", err); }
  };

  const prevMonth = () => {
    if (dispMonth === 0) { setDispYear(y => y - 1); setDispMonth(11); }
    else setDispMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (dispMonth === 11) { setDispYear(y => y + 1); setDispMonth(0); }
    else setDispMonth(m => m + 1);
  };

  const monthGrid = getMonthGrid(dispYear, dispMonth);
  const weekDays = getWeekDays(selectedDay);

  const bookingsOnDate = (dateStr: string) => bookings.filter(b => b.date === dateStr);
  const blocksOnDate = (dateStr: string) => blockedDates.filter(b => b.date === dateStr);

  const monthPrefix = `${dispYear}-${String(dispMonth+1).padStart(2,"0")}`;
  const bookedDaysInMonth = [...new Set(bookings.filter(b => b.date.startsWith(monthPrefix)).map(b => b.date))].sort();

  const styles = makeStyles(insets.top);

  function renderMonthGrid() {
    const rows: React.ReactElement[] = [];
    for (let r = 0; r < monthGrid.length / 7; r++) {
      const row = monthGrid.slice(r * 7, (r+1) * 7);
      rows.push(
        <View key={r} style={styles.gridRow}>
          {row.map((dateStr, ci) => {
            if (!dateStr) return <View key={ci} style={styles.dayCell} />;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDay;
            const dayBk = bookingsOnDate(dateStr);
            const hasBlock = blocksOnDate(dateStr).length > 0;
            const dayNum = parseInt(dateStr.split("-")[2]);
            const dots = [
              ...dayBk.filter(b => b.status === "confirmed").slice(0,1).map(() => GREEN),
              ...dayBk.filter(b => isPendingStatus(b.status)).slice(0,1).map(() => AMBER),
              ...(hasBlock ? [RED] : []),
            ].slice(0, 3);
            return (
              <Pressable key={dateStr} style={styles.dayCell} onPress={() => setSelectedDay(dateStr)}>
                <View style={[styles.dayCellInner, isToday && styles.todayCircle, isSelected && !isToday && styles.selectedCircle]}>
                  <Text style={[styles.dayCellNum, isToday && styles.todayNum, isSelected && !isToday && styles.selectedNum]}>{dayNum}</Text>
                </View>
                <View style={styles.dotRow}>
                  {dots.map((color, di) => <View key={di} style={[styles.dot, { backgroundColor: color }]} />)}
                </View>
              </Pressable>
            );
          })}
        </View>
      );
    }
    return rows;
  }

  function renderEventBlock(b: CalendarBooking, compact = false) {
    const sc = statusPill(b.status);
    return (
      <View key={b.id} style={[styles.eventBlock, { backgroundColor: statusBg(b.status), borderLeftColor: statusBorder(b.status) }]}>
        <View style={styles.eventBlockInner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eventTitle} numberOfLines={compact ? 1 : 2}>{b.clientName} — {b.serviceName}</Text>
            {!compact && <Text style={styles.eventMeta}>{b.startTime}{b.endTime ? ` – ${b.endTime}` : ""}</Text>}
          </View>
          {!compact && (
            <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusPillText, { color: sc.text }]}>{statusLabel(b.status)}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  function renderDayView() {
    const dayBk = bookingsOnDate(selectedDay);
    const dayBlocks = blocksOnDate(selectedDay);
    const confirmed = dayBk.filter(b => b.status === "confirmed").length;
    const pending = dayBk.filter(b => isPendingStatus(b.status)).length;
    const dow = WEEKDAY_LABELS[new Date(selectedDay + "T12:00:00").getDay()];
    return (
      <View style={styles.dayView}>
        <View style={styles.dayViewHeader}>
          <Text style={styles.dayViewTitle}>{dow}, {formatMonthDay(selectedDay)}</Text>
          {(confirmed + pending > 0) && (
            <Text style={styles.dayViewSubtitle}>
              {[confirmed > 0 && `${confirmed} confirmed`, pending > 0 && `${pending} pending`].filter(Boolean).join(" · ")}
            </Text>
          )}
        </View>
        {HOURS.map(hour => {
          const hourBk = dayBk.filter(b => parseHour(b.startTime) === hour);
          const hourBlocks = dayBlocks.filter(b => {
            if (b.isFullDay) return hour === HOURS[0];
            return b.startTime ? parseInt(b.startTime.split(":")[0]) === hour : false;
          });
          return (
            <View key={hour} style={styles.hourRow}>
              <Text style={styles.hourLabel}>{HOUR_LABELS[hour]}</Text>
              <View style={styles.hourContent}>
                {hourBlocks.map((bl, i) => (
                  <View key={`bl-${i}`} style={[styles.eventBlock, { backgroundColor: "#2a1818", borderLeftColor: RED }]}>
                    <Text style={[styles.eventTitle, { color: RED }]}>Blocked{bl.reason ? ` — ${bl.reason}` : ""}</Text>
                    <Text style={styles.eventMeta}>{bl.isFullDay ? "All day" : `${bl.startTime} – ${bl.endTime}`}</Text>
                  </View>
                ))}
                {hourBk.map(b => renderEventBlock(b))}
                {hourBk.length === 0 && hourBlocks.length === 0 && (
                  <Text style={styles.emptyHourDash}>–</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function renderWeekView() {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.weekHeaderRow}>
            <View style={styles.weekGutter} />
            {weekDays.map(dateStr => {
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDay;
              const dayNum = parseInt(dateStr.split("-")[2]);
              const abbr = WEEKDAY_LABELS[new Date(dateStr + "T12:00:00").getDay()][0];
              return (
                <Pressable key={dateStr} style={styles.weekColHeader} onPress={() => { setSelectedDay(dateStr); setViewMode("day"); }}>
                  <Text style={styles.weekColAbbr}>{abbr}</Text>
                  <View style={[styles.weekColCircle, isToday && { backgroundColor: AMBER }, isSelected && !isToday && { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                    <Text style={[styles.weekColNum, (isToday || isSelected) && { color: isToday ? "#000" : CREAM }]}>{dayNum}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {HOURS.map(hour => (
            <View key={hour} style={styles.weekHourRow}>
              <View style={styles.weekGutter}>
                <Text style={styles.weekHourLabel}>{HOUR_LABELS[hour]}</Text>
              </View>
              {weekDays.map(dateStr => {
                const dayBk = bookingsOnDate(dateStr).filter(b => parseHour(b.startTime) === hour);
                return (
                  <View key={dateStr} style={styles.weekCell}>
                    {dayBk.map(b => (
                      <View key={b.id} style={[styles.weekEvent, { borderLeftColor: statusBorder(b.status), backgroundColor: statusBg(b.status) }]}>
                        <Text style={[styles.weekEventText, { color: statusBorder(b.status) }]} numberOfLines={2}>{b.serviceName}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  function renderListView() {
    if (bookedDaysInMonth.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Feather name="calendar" size={24} color={GOLD} />
          <Text style={styles.emptyTitle}>No shoots in {MONTHS[dispMonth]}</Text>
        </View>
      );
    }
    return (
      <View>
        {bookedDaysInMonth.map(dateStr => {
          const dayBk = bookingsOnDate(dateStr);
          const isToday = dateStr === today;
          const confirmed = dayBk.filter(b => b.status === "confirmed").length;
          const pending = dayBk.filter(b => isPendingStatus(b.status)).length;
          const dayNum = parseInt(dateStr.split("-")[2]);
          return (
            <View key={dateStr} style={styles.listDay}>
              <View style={styles.listDayHeader}>
                <View style={[styles.listDateSquare, isToday && { backgroundColor: AMBER }]}>
                  <Text style={[styles.listDateNum, isToday && { color: "#000" }]}>{dayNum}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listMonthDay}>{formatMonthDay(dateStr)}</Text>
                  <Text style={styles.listCountText}>{dayBk.length} shoot{dayBk.length !== 1 ? "s" : ""}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {confirmed > 0 && <View style={[styles.listBadge, { backgroundColor: "rgba(63,203,110,0.15)" }]}><Text style={[styles.listBadgeText, { color: GREEN }]}>{confirmed} confirmed</Text></View>}
                  {pending > 0 && <View style={[styles.listBadge, { backgroundColor: "rgba(224,169,59,0.15)" }]}><Text style={[styles.listBadgeText, { color: AMBER }]}>{pending} pending</Text></View>}
                </View>
              </View>
              {dayBk.map(b => renderEventBlock(b))}
            </View>
          );
        })}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={GOLD} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={CREAM} />
        </Pressable>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={styles.headerRight}>
          <Pressable style={styles.iconBtn}><Feather name="search" size={20} color={CREAM_DIM} /></Pressable>
          <Pressable style={styles.iconBtn}><Feather name="settings" size={20} color={CREAM_DIM} /></Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(true); }} tintColor={GOLD} />}
      >
        {/* Mini month grid */}
        <View style={styles.monthContainer}>
          <View style={styles.monthNav}>
            <Pressable style={styles.navArrow} onPress={prevMonth}><Feather name="chevron-left" size={20} color={CREAM} /></Pressable>
            <Text style={styles.monthTitle}>{MONTHS[dispMonth]} {dispYear}</Text>
            <Pressable style={styles.navArrow} onPress={nextMonth}><Feather name="chevron-right" size={20} color={CREAM} /></Pressable>
          </View>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map(w => <Text key={w} style={styles.weekdayHeader}>{w}</Text>)}
          </View>
          {renderMonthGrid()}
          <View style={styles.legendRow}>
            {([{ color: GREEN, label: "Confirmed" }, { color: AMBER, label: "Pending" }, { color: RED, label: "Blocked" }]).map(l => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                <Text style={styles.legendText}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* View toggle */}
        <View style={styles.viewToggle}>
          {(["week", "day", "list"] as ViewMode[]).map(v => (
            <Pressable key={v} style={[styles.toggleSeg, viewMode === v && styles.toggleSegActive]} onPress={() => setViewMode(v)}>
              <Text style={[styles.toggleSegText, viewMode === v && styles.toggleSegTextActive]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.viewContent}>
          {viewMode === "day" && renderDayView()}
          {viewMode === "week" && renderWeekView()}
          {viewMode === "list" && renderListView()}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function makeStyles(topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: BG },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: topInset + 12,
      paddingBottom: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
    },
    backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginRight: 8 },
    headerTitle: { flex: 1, color: CREAM, fontSize: 18, fontWeight: "700" },
    headerRight: { flexDirection: "row", gap: 4 },
    iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    scrollContent: { paddingBottom: 20 },
    // Month grid
    monthContainer: { padding: 16 },
    monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
    navArrow: { padding: 6 },
    monthTitle: { color: CREAM, fontSize: 16, fontWeight: "700" },
    weekdayRow: { flexDirection: "row", marginBottom: 4 },
    weekdayHeader: { flex: 1, textAlign: "center", color: CREAM_DIM, fontSize: 11, fontWeight: "600" },
    gridRow: { flexDirection: "row", marginBottom: 2 },
    dayCell: { flex: 1, alignItems: "center", paddingVertical: 2 },
    dayCellInner: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    todayCircle: { backgroundColor: AMBER },
    selectedCircle: { backgroundColor: "rgba(255,255,255,0.2)" },
    dayCellNum: { color: CREAM_DIM, fontSize: 13 },
    todayNum: { color: "#000", fontWeight: "700" },
    selectedNum: { color: CREAM, fontWeight: "600" },
    dotRow: { flexDirection: "row", gap: 2, height: 5, marginTop: 1 },
    dot: { width: 4, height: 4, borderRadius: 2 },
    legendRow: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 12 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: CREAM_DIM, fontSize: 11 },
    // View toggle
    viewToggle: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: SURFACE,
      borderRadius: 10,
      padding: 3,
      borderWidth: 1,
      borderColor: BORDER,
    },
    toggleSeg: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
    toggleSegActive: { backgroundColor: SURFACE2 },
    toggleSegText: { color: CREAM_DIM, fontSize: 13, fontWeight: "500" },
    toggleSegTextActive: { color: CREAM, fontWeight: "600" },
    viewContent: { paddingHorizontal: 16 },
    // Day view
    dayView: {},
    dayViewHeader: { marginBottom: 12 },
    dayViewTitle: { color: CREAM, fontSize: 15, fontWeight: "700" },
    dayViewSubtitle: { color: CREAM_DIM, fontSize: 12, marginTop: 2 },
    hourRow: { flexDirection: "row", minHeight: 44, marginBottom: 2 },
    hourLabel: { width: 50, color: "rgba(255,255,255,0.22)", fontSize: 11, textAlign: "right", paddingRight: 8, paddingTop: 12 },
    hourContent: { flex: 1, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 4 },
    eventBlock: { borderLeftWidth: 3, borderRadius: 6, padding: 8, marginBottom: 4 },
    eventBlockInner: { flexDirection: "row", alignItems: "flex-start" },
    eventTitle: { color: CREAM, fontSize: 12, fontWeight: "600" },
    eventMeta: { color: CREAM_DIM, fontSize: 11, marginTop: 2 },
    statusPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, marginLeft: 8, alignSelf: "flex-start" },
    statusPillText: { fontSize: 10, fontWeight: "700" },
    emptyHourDash: { color: "rgba(255,255,255,0.08)", fontSize: 12, paddingLeft: 4 },
    // Week view
    weekHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 8, marginBottom: 2 },
    weekGutter: { width: 52, justifyContent: "flex-end", alignItems: "flex-end", paddingRight: 8 },
    weekColHeader: { width: 52, alignItems: "center" },
    weekColAbbr: { color: CREAM_DIM, fontSize: 11, marginBottom: 4 },
    weekColCircle: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    weekColNum: { color: CREAM_DIM, fontSize: 12 },
    weekHourRow: { flexDirection: "row", minHeight: 46, borderTopWidth: 1, borderTopColor: BORDER },
    weekHourLabel: { color: "rgba(255,255,255,0.2)", fontSize: 10, paddingTop: 4 },
    weekCell: { width: 52, borderLeftWidth: 1, borderLeftColor: BORDER, padding: 2 },
    weekEvent: { borderLeftWidth: 2, borderRadius: 3, padding: 3, marginBottom: 1 },
    weekEventText: { fontSize: 9, fontWeight: "600" },
    // List view
    listDay: { marginBottom: 20 },
    listDayHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    listDateSquare: { width: 38, height: 38, borderRadius: 8, backgroundColor: SURFACE, alignItems: "center", justifyContent: "center" },
    listDateNum: { color: CREAM, fontSize: 16, fontWeight: "700" },
    listMonthDay: { color: CREAM, fontSize: 14, fontWeight: "600" },
    listCountText: { color: CREAM_DIM, fontSize: 12 },
    listBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    listBadgeText: { fontSize: 11, fontWeight: "600" },
    // Empty
    emptyState: { alignItems: "center", gap: 12, marginTop: 40, paddingBottom: 40 },
    emptyTitle: { color: CREAM_DIM, fontSize: 14 },
  });
}
