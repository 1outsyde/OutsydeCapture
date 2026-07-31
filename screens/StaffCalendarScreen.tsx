import React, { useState, useCallback } from "react";
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
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";

// ─── Constants ──────────────────────────────────────────────────────────────

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
const UNASSIGNED_COLOR = "#555555";

const STAFF_PALETTE = [
  "#7C5CBF", "#C9933A", "#378ADD", "#E05C8A",
  "#3FCB6E", "#E0A93B", "#E85D5D", "#48B4A0",
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const WEEKDAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const HOUR_LABELS: Record<number, string> = {
  8: "8 AM", 9: "9 AM", 10: "10 AM", 11: "11 AM", 12: "12 PM",
  13: "1 PM", 14: "2 PM", 15: "3 PM", 16: "4 PM", 17: "5 PM",
};

const TIME_GUTTER = 52;
const STAFF_COL = 120;

// ─── Types ──────────────────────────────────────────────────────────────────

type ViewMode = "day" | "week" | "list";

interface StaffMember {
  id: string;
  displayName: string;
  color: string;
  initials: string;
}

interface RawBooking {
  id: string;
  date: string;
  customerName: string;
  serviceName: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  amount: number;
  staffMemberId: string | null;
  startTime: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function convertTo12Hour(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getWeekDays(dateStr: string): string[] {
  const d = new Date(dateStr + "T12:00:00");
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(sunday);
    dd.setDate(sunday.getDate() + i);
    return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
  });
}

function getMonthGrid(year: number, month: number): Array<string | null> {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatMonthDay(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  return `${MONTHS[parts[1] - 1]} ${parts[2]}`;
}

function statusPill(status: string): { bg: string; text: string } {
  if (status === "confirmed") return { bg: "rgba(63,203,110,0.15)", text: GREEN };
  if (status === "pending") return { bg: "rgba(224,169,59,0.15)", text: AMBER };
  if (status === "completed") return { bg: "rgba(201,147,58,0.15)", text: GOLD };
  if (status === "cancelled") return { bg: "rgba(232,93,93,0.1)", text: RED };
  return { bg: "rgba(255,255,255,0.08)", text: CREAM_DIM };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function StaffCalendarScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { getToken } = useAuth();

  const today = todayISO();
  const now = new Date();

  const [selectedDay, setSelectedDay] = useState(today);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [dispYear, setDispYear] = useState(now.getFullYear());
  const [dispMonth, setDispMonth] = useState(now.getMonth());
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const [bookings, setBookings] = useState<RawBooking[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    const [bookingsResult, staffResult] = await Promise.allSettled([
      api.getBusinessBookings(token),
      api.getVendorStaff(token),
      api.getWeeklyAvailability(token, "business"),
      api.getBlocks(token, "business"),
    ]);

    if (staffResult.status === "fulfilled") {
      const rawStaff: any[] = staffResult.value.staff || [];
      setStaff(rawStaff.map((s: any, idx: number) => ({
        id: String(s.id),
        displayName: String(s.displayName || s.name || "Staff"),
        color: STAFF_PALETTE[idx % STAFF_PALETTE.length],
        initials: getInitials(String(s.displayName || s.name || "S")),
      })));
    }

    if (bookingsResult.status === "fulfilled") {
      setBookings(bookingsResult.value.bookings.map((b: any) => ({
        id: b.id,
        date: b.date,
        customerName: b.customerName,
        serviceName: b.serviceName,
        status: b.status,
        amount: b.amount,
        staffMemberId: b.staffMemberId ?? null,
        startTime: b.time ? convertTo12Hour(b.time) : "9:00 AM",
      })));
    }

    setLoading(false);
    setRefreshing(false);
  }, [getToken]);

  useFocusEffect(fetchData);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const staffById = new Map<string, StaffMember>(staff.map((s: StaffMember) => [s.id, s]));

  const hasUnassigned = bookings.some((b: RawBooking) => !b.staffMemberId);

  const monthPrefix = `${dispYear}-${String(dispMonth + 1).padStart(2, "0")}`;
  const monthBookings = bookings.filter((b: RawBooking) => b.date.startsWith(monthPrefix));
  const bookedDaysInMonth = [...new Set(monthBookings.map((b: RawBooking) => b.date))].sort();

  const weekDays = getWeekDays(selectedDay);
  const monthGrid = getMonthGrid(dispYear, dispMonth);

  function bookingsOnDate(dateStr: string): RawBooking[] {
    return bookings.filter((b: RawBooking) => b.date === dateStr);
  }

  function getStaffColor(staffId: string | null): string {
    if (!staffId) return UNASSIGNED_COLOR;
    return staffById.get(staffId)?.color ?? UNASSIGNED_COLOR;
  }

  function getMonthDotColors(dateStr: string): string[] {
    const dayBk = bookings.filter((b: RawBooking) => b.date === dateStr);
    const seen = new Set<string>();
    const colors: string[] = [];
    for (const b of dayBk) {
      const key = b.staffMemberId ?? "__unassigned__";
      if (!seen.has(key)) {
        seen.add(key);
        colors.push(getStaffColor(b.staffMemberId));
      }
      if (colors.length >= 3) break;
    }
    return colors;
  }

  const prevMonth = () => {
    if (dispMonth === 0) { setDispYear((y: number) => y - 1); setDispMonth(11); }
    else setDispMonth((m: number) => m - 1);
  };
  const nextMonth = () => {
    if (dispMonth === 11) { setDispYear((y: number) => y + 1); setDispMonth(0); }
    else setDispMonth((m: number) => m + 1);
  };

  const styles = makeStyles(insets.top);

  // ─── Render helpers ────────────────────────────────────────────────────────

  function renderMonthGrid() {
    const rows: React.ReactElement[] = [];
    for (let r = 0; r < monthGrid.length / 7; r++) {
      const row = monthGrid.slice(r * 7, (r + 1) * 7);
      rows.push(
        <View key={r} style={styles.gridRow}>
          {row.map((dateStr, ci) => {
            if (!dateStr) return <View key={ci} style={styles.dayCell} />;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDay;
            const dayNum = parseInt(dateStr.split("-")[2]);
            const dots = getMonthDotColors(dateStr);
            return (
              <Pressable key={dateStr} style={styles.dayCell} onPress={() => setSelectedDay(dateStr)}>
                <View style={[
                  styles.dayCellInner,
                  isToday && styles.todayCircle,
                  isSelected && !isToday && styles.selectedCircle,
                ]}>
                  <Text style={[
                    styles.dayCellNum,
                    isToday && styles.todayNum,
                    isSelected && !isToday && styles.selectedNum,
                  ]}>{dayNum}</Text>
                </View>
                <View style={styles.dotRow}>
                  {dots.map((color, di) => (
                    <View key={di} style={[styles.dot, { backgroundColor: color }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      );
    }
    return rows;
  }

  function renderStaffFilterBar() {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        <Pressable
          style={[styles.filterPill, !selectedStaffId && styles.filterPillSelectedAll]}
          onPress={() => setSelectedStaffId(null)}
        >
          <View style={[styles.filterDot, { backgroundColor: CREAM_DIM }]} />
          <Text style={[styles.filterText, !selectedStaffId && styles.filterTextSelected]}>All</Text>
        </Pressable>
        {staff.map((s: StaffMember) => (
          <Pressable
            key={s.id}
            style={[
              styles.filterPill,
              selectedStaffId === s.id && { borderColor: s.color, borderWidth: 1.5 },
            ]}
            onPress={() => setSelectedStaffId(selectedStaffId === s.id ? null : s.id)}
          >
            <View style={[styles.filterDot, { backgroundColor: s.color }]} />
            <Text style={[styles.filterText, selectedStaffId === s.id && { color: s.color, fontWeight: "600" }]}>
              {s.displayName.split(" ")[0]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  function renderStaffEventBlock(b: RawBooking, color: string) {
    return (
      <View key={b.id} style={[styles.staffEventBlock, { backgroundColor: color + "22", borderLeftColor: color }]}>
        <Text style={styles.staffEventClient} numberOfLines={1}>{b.customerName}</Text>
        <Text style={styles.staffEventService} numberOfLines={1}>{b.serviceName}</Text>
        <Text style={[styles.staffEventTime, { color }]}>{b.startTime}</Text>
      </View>
    );
  }

  function renderDayView() {
    const dow = WEEKDAY_LABELS[new Date(selectedDay + "T12:00:00").getDay()];
    const dayLabel = `${dow}, ${formatMonthDay(selectedDay)}`;

    if (selectedStaffId !== null) {
      // Single-staff full-width layout
      const s = staffById.get(selectedStaffId);
      const color = s?.color ?? UNASSIGNED_COLOR;
      const dayBk = bookings.filter((b: RawBooking) => b.date === selectedDay && b.staffMemberId === selectedStaffId);
      return (
        <View style={styles.dayView}>
          <Text style={styles.dayViewTitle}>{dayLabel}</Text>
          {HOURS.map(hour => {
            const hourBk = dayBk.filter((b: RawBooking) => parseHour(b.startTime) === hour);
            return (
              <View key={hour} style={styles.hourRow}>
                <Text style={styles.hourLabel}>{HOUR_LABELS[hour]}</Text>
                <View style={styles.hourContent}>
                  {hourBk.length === 0
                    ? <Text style={styles.emptyHourDash}>–</Text>
                    : hourBk.map((b: RawBooking) => renderStaffEventBlock(b, color))}
                </View>
              </View>
            );
          })}
          {dayBk.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={24} color={GOLD} />
              <Text style={styles.emptyTitle}>No bookings this day</Text>
            </View>
          )}
        </View>
      );
    }

    // All-staff multi-column layout
    const columns: Array<{ key: string; label: string; initials: string; color: string }> = [
      ...staff.map((s: StaffMember) => ({ key: s.id, label: s.displayName.split(" ")[0], initials: s.initials, color: s.color })),
      ...(hasUnassigned ? [{ key: "__unassigned__", label: "Unassigned", initials: "?", color: UNASSIGNED_COLOR }] : []),
    ];

    const dayBkAll = bookingsOnDate(selectedDay);

    return (
      <View style={styles.dayView}>
        <Text style={styles.dayViewTitle}>{dayLabel}</Text>
        {dayBkAll.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={24} color={GOLD} />
            <Text style={styles.emptyTitle}>No bookings this day</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Column headers */}
              <View style={styles.multiHeaderRow}>
                <View style={{ width: TIME_GUTTER }} />
                {columns.map(col => (
                  <View key={col.key} style={styles.multiColHeader}>
                    <View style={[styles.staffAvatar, { backgroundColor: col.color }]}>
                      <Text style={styles.staffAvatarText}>{col.initials}</Text>
                    </View>
                    <Text style={[styles.staffColName, { color: col.color }]} numberOfLines={1}>{col.label}</Text>
                  </View>
                ))}
              </View>
              {/* Hour rows */}
              {HOURS.map(hour => (
                <View key={hour} style={styles.multiHourRow}>
                  <Text style={styles.multiHourLabel}>{HOUR_LABELS[hour]}</Text>
                  {columns.map(col => {
                    const isUnassigned = col.key === "__unassigned__";
                    const colBk = dayBkAll.filter(b =>
                      parseHour(b.startTime) === hour &&
                      (isUnassigned ? !b.staffMemberId : b.staffMemberId === col.key)
                    );
                    return (
                      <View key={col.key} style={styles.multiCell}>
                        {colBk.length === 0
                          ? <Text style={styles.emptyHourDash}>–</Text>
                          : colBk.map(b => renderStaffEventBlock(b, col.color))}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  function renderWeekView() {
    const filterBk = (dateStr: string, hour: number) =>
      bookings.filter((b: RawBooking) =>
        b.date === dateStr &&
        parseHour(b.startTime) === hour &&
        (selectedStaffId ? b.staffMemberId === selectedStaffId : true)
      );

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
                <Pressable
                  key={dateStr}
                  style={styles.weekColHeader}
                  onPress={() => { setSelectedDay(dateStr); setViewMode("day"); }}
                >
                  <Text style={styles.weekColAbbr}>{abbr}</Text>
                  <View style={[
                    styles.weekColCircle,
                    isToday && { backgroundColor: GOLD },
                    isSelected && !isToday && { backgroundColor: "rgba(255,255,255,0.18)" },
                  ]}>
                    <Text style={[
                      styles.weekColNum,
                      (isToday || isSelected) && { color: isToday ? "#000" : CREAM },
                    ]}>{dayNum}</Text>
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
                const dayBk = filterBk(dateStr, hour);
                return (
                  <View key={dateStr} style={styles.weekCell}>
                    {dayBk.map((b: RawBooking) => {
                      const color = getStaffColor(b.staffMemberId);
                      const staffName = b.staffMemberId
                        ? staffById.get(b.staffMemberId)?.displayName.split(" ")[0] ?? "Staff"
                        : "Unassigned";
                      return (
                        <View key={b.id} style={[styles.weekEvent, { borderLeftColor: color, backgroundColor: color + "18" }]}>
                          <Text style={[styles.weekEventText, { color }]} numberOfLines={2}>{staffName}</Text>
                        </View>
                      );
                    })}
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
    const filteredDays = selectedStaffId
      ? bookedDaysInMonth.filter((d: string) => bookings.some((b: RawBooking) => b.date === d && b.staffMemberId === selectedStaffId))
      : bookedDaysInMonth;

    if (filteredDays.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Feather name="calendar" size={24} color={GOLD} />
          <Text style={styles.emptyTitle}>No bookings in {MONTHS[dispMonth]}</Text>
        </View>
      );
    }

    return (
      <View>
        {filteredDays.map(dateStr => {
          const dayBk = bookings.filter((b: RawBooking) =>
            b.date === dateStr &&
            (selectedStaffId ? b.staffMemberId === selectedStaffId : true)
          );
          const isToday = dateStr === today;
          const dayNum = parseInt(dateStr.split("-")[2]);
          return (
            <View key={dateStr} style={styles.listDay}>
              <View style={styles.listDayHeader}>
                <View style={[styles.listDateSquare, isToday && { backgroundColor: GOLD }]}>
                  <Text style={[styles.listDateNum, isToday && { color: "#000" }]}>{dayNum}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listMonthDay}>{formatMonthDay(dateStr)}</Text>
                  <Text style={styles.listCountText}>{dayBk.length} booking{dayBk.length !== 1 ? "s" : ""}</Text>
                </View>
              </View>
              {dayBk.map((b: RawBooking) => {
                const color = getStaffColor(b.staffMemberId);
                const staffName = b.staffMemberId
                  ? staffById.get(b.staffMemberId)?.displayName.split(" ")[0] ?? "Staff"
                  : "Unassigned";
                const sp = statusPill(b.status);
                return (
                  <View key={b.id} style={styles.listRow}>
                    <View style={[styles.listStaffDot, { backgroundColor: color }]} />
                    <View style={styles.listRowInfo}>
                      <Text style={[styles.listStaffName, { color }]}>{staffName}</Text>
                      <Text style={styles.listClientService} numberOfLines={1}>
                        {b.customerName} · {b.serviceName}
                      </Text>
                      <Text style={styles.listTime}>{b.startTime}</Text>
                      <View style={[styles.listStatusPill, { backgroundColor: sp.bg }]}>
                        <Text style={[styles.listStatusText, { color: sp.text }]}>
                          {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={GOLD} />
      </View>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={CREAM} />
        </Pressable>
        <Text style={styles.headerTitle}>Staff Calendar</Text>
        <View style={styles.headerRight}>
          <Pressable style={styles.iconBtn}><Feather name="search" size={20} color={CREAM_DIM} /></Pressable>
          <Pressable style={styles.iconBtn}><Feather name="settings" size={20} color={CREAM_DIM} /></Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(true); }}
            tintColor={GOLD}
          />
        }
      >
        {/* Month mini-grid */}
        <View style={styles.monthContainer}>
          <View style={styles.monthNav}>
            <Pressable style={styles.navArrow} onPress={prevMonth}>
              <Feather name="chevron-left" size={20} color={CREAM} />
            </Pressable>
            <Text style={styles.monthTitle}>{MONTHS[dispMonth]} {dispYear}</Text>
            <Pressable style={styles.navArrow} onPress={nextMonth}>
              <Feather name="chevron-right" size={20} color={CREAM} />
            </Pressable>
          </View>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map(w => (
              <Text key={w} style={styles.weekdayHeader}>{w}</Text>
            ))}
          </View>
          {renderMonthGrid()}
        </View>

        {/* Staff filter bar */}
        {renderStaffFilterBar()}

        {/* View toggle */}
        <View style={styles.viewToggle}>
          {(["day", "week", "list"] as ViewMode[]).map(v => (
            <Pressable
              key={v}
              style={[styles.toggleSeg, viewMode === v && styles.toggleSegActive]}
              onPress={() => setViewMode(v)}
            >
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

// ─── Styles ─────────────────────────────────────────────────────────────────

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
    todayCircle: { backgroundColor: GOLD },
    selectedCircle: { backgroundColor: "rgba(255,255,255,0.2)" },
    dayCellNum: { color: CREAM_DIM, fontSize: 13 },
    todayNum: { color: "#000", fontWeight: "700" },
    selectedNum: { color: CREAM, fontWeight: "600" },
    dotRow: { flexDirection: "row", gap: 2, height: 5, marginTop: 1 },
    dot: { width: 4, height: 4, borderRadius: 2 },
    // Staff filter bar
    filterBar: { maxHeight: 54 },
    filterBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: "row" },
    filterPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: SURFACE,
      borderWidth: 1,
      borderColor: "transparent",
    },
    filterPillSelectedAll: { borderColor: CREAM, borderWidth: 1.5 },
    filterDot: { width: 8, height: 8, borderRadius: 4 },
    filterText: { color: CREAM_DIM, fontSize: 13, fontWeight: "500" },
    filterTextSelected: { color: CREAM, fontWeight: "600" },
    // View toggle
    viewToggle: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginVertical: 12,
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
    // Day view (single staff or empty)
    dayView: { marginTop: 4 },
    dayViewTitle: { color: CREAM, fontSize: 15, fontWeight: "700", marginBottom: 12 },
    hourRow: { flexDirection: "row", minHeight: 44, marginBottom: 2 },
    hourLabel: { width: 50, color: "rgba(255,255,255,0.22)", fontSize: 11, textAlign: "right", paddingRight: 8, paddingTop: 12 },
    hourContent: { flex: 1, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 4 },
    emptyHourDash: { color: "rgba(255,255,255,0.08)", fontSize: 12, paddingLeft: 4 },
    // Staff event block (shared by day + single-staff views)
    staffEventBlock: { borderLeftWidth: 3, borderRadius: 6, padding: 8, marginBottom: 4 },
    staffEventClient: { color: CREAM, fontSize: 12, fontWeight: "600" },
    staffEventService: { color: CREAM_DIM, fontSize: 11, marginTop: 1 },
    staffEventTime: { fontSize: 11, marginTop: 1 },
    // Multi-column day view
    multiHeaderRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
      paddingBottom: 8,
      marginBottom: 2,
    },
    multiColHeader: { width: STAFF_COL, alignItems: "center", paddingVertical: 4 },
    staffAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    staffAvatarText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    staffColName: { fontSize: 11, fontWeight: "600", textAlign: "center" },
    multiHourRow: { flexDirection: "row", minHeight: 52, borderTopWidth: 1, borderTopColor: BORDER },
    multiHourLabel: { width: TIME_GUTTER, color: "rgba(255,255,255,0.22)", fontSize: 10, paddingTop: 4, paddingRight: 6, textAlign: "right" },
    multiCell: { width: STAFF_COL, borderLeftWidth: 1, borderLeftColor: BORDER, padding: 2, paddingTop: 4 },
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
    listRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER },
    listStaffDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
    listRowInfo: { flex: 1 },
    listStaffName: { fontSize: 12, fontWeight: "700" },
    listClientService: { color: CREAM_DIM, fontSize: 12, marginTop: 2 },
    listTime: { color: CREAM_DIM, fontSize: 11, marginTop: 2 },
    listStatusPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start", marginTop: 4 },
    listStatusText: { fontSize: 10, fontWeight: "700" },
    // Empty state
    emptyState: { alignItems: "center", gap: 12, marginTop: 40, paddingBottom: 40 },
    emptyTitle: { color: CREAM_DIM, fontSize: 14 },
  });
}
