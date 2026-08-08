import { VendorBookerAvailabilitySlot, BlockedDate } from "@/services/api";
import { AvailabilitySlot, TimeSlot } from "@/types";

export interface ComputedAvailability {
  date: string;
  dayOfWeek: number;
  timeSlots: TimeSlot[];
}

function generateTimeSlots(startTime: string, endTime: string, slotDuration: number = 60): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  
  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  let slotIndex = 0;
  while (currentMinutes + slotDuration <= endMinutes) {
    const slotStartHour = Math.floor(currentMinutes / 60);
    const slotStartMin = currentMinutes % 60;
    const slotEndMinutes = currentMinutes + slotDuration;
    const slotEndHour = Math.floor(slotEndMinutes / 60);
    const slotEndMin = slotEndMinutes % 60;
    
    slots.push({
      id: `slot-${slotIndex++}`,
      startTime: `${slotStartHour.toString().padStart(2, "0")}:${slotStartMin.toString().padStart(2, "0")}`,
      endTime: `${slotEndHour.toString().padStart(2, "0")}:${slotEndMin.toString().padStart(2, "0")}`,
      available: true,
    });
    
    currentMinutes += slotDuration;
  }
  
  return slots;
}

function isDateBlocked(
  dateStr: string,
  blockedDates: BlockedDate[]
): { isFullyBlocked: boolean; blockedRanges: Array<{ startTime: string; endTime: string }> } {
  const blockedForDate = blockedDates.filter(bd => bd.date === dateStr);
  
  if (blockedForDate.length === 0) {
    return { isFullyBlocked: false, blockedRanges: [] };
  }
  
  const hasFullDayBlock = blockedForDate.some(bd => bd.isFullDay === true || (!bd.startTime && !bd.endTime));
  
  if (hasFullDayBlock) {
    return { isFullyBlocked: true, blockedRanges: [] };
  }
  
  const blockedRanges = blockedForDate
    .filter(bd => bd.startTime && bd.endTime)
    .map(bd => ({ startTime: bd.startTime!, endTime: bd.endTime! }));
  
  return { isFullyBlocked: false, blockedRanges };
}

function isSlotBlocked(slot: TimeSlot, blockedRanges: Array<{ startTime: string; endTime: string }>): boolean {
  for (const range of blockedRanges) {
    const slotStart = slot.startTime;
    const slotEnd = slot.endTime;
    const blockStart = range.startTime;
    const blockEnd = range.endTime;
    
    if (slotStart < blockEnd && slotEnd > blockStart) {
      return true;
    }
  }
  return false;
}

export function computeAvailableDates(
  baseAvailability: VendorBookerAvailabilitySlot[],
  blockedDates: BlockedDate[],
  daysAhead: number = 60,
  slotDuration: number = 60
): AvailabilitySlot[] {
  const availableSlots: AvailabilitySlot[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const recurringByDayOfWeek: Map<number, VendorBookerAvailabilitySlot[]> = new Map();
  
  for (const slot of baseAvailability) {
    if (slot.isRecurring && slot.dayOfWeek !== undefined && slot.dayOfWeek !== null) {
      const existing = recurringByDayOfWeek.get(slot.dayOfWeek) || [];
      existing.push(slot);
      recurringByDayOfWeek.set(slot.dayOfWeek, existing);
    }
  }
  
  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split("T")[0];
    
    const dayAvailability = recurringByDayOfWeek.get(dayOfWeek);
    if (!dayAvailability || dayAvailability.length === 0) {
      continue;
    }
    
    const { isFullyBlocked, blockedRanges } = isDateBlocked(dateStr, blockedDates);
    if (isFullyBlocked) {
      continue;
    }
    
    let allTimeSlots: TimeSlot[] = [];
    
    for (const avail of dayAvailability) {
      if (avail.startTime && avail.endTime) {
        const slots = generateTimeSlots(avail.startTime, avail.endTime, slotDuration);
        allTimeSlots = allTimeSlots.concat(slots);
      }
    }
    
    if (blockedRanges.length > 0) {
      allTimeSlots = allTimeSlots.map(slot => ({
        ...slot,
        available: !isSlotBlocked(slot, blockedRanges),
      }));
    }
    
    const availableTimeSlots = allTimeSlots.filter(s => s.available);
    
    if (availableTimeSlots.length > 0) {
      availableSlots.push({
        date: dateStr,
        timeSlots: availableTimeSlots,
      });
    }
  }
  
  return availableSlots;
}

/**
 * Raw-row layer. Given the startAt/endAt timestamps of a provider_blocks row,
 * decide whether it represents a full-day block.
 *
 * provider_blocks has no is_full_day column (shared/schema.ts:1598-1606), so
 * full day is derived from the span: midnight through end-of-day.
 *
 * For the already-mapped-object equivalent — deciding whether a BlockedDate
 * covers a whole day — see isDateBlocked above, which operates one layer up.
 */
export function isFullDaySpan(startAt?: string, endAt?: string): boolean {
  const startTime = startAt?.split("T")[1]?.substring(0, 5);
  const endTime = endAt?.split("T")[1]?.substring(0, 5);
  if (!startTime || !endTime) return false;
  return startTime === "00:00" && endTime >= "23:59";
}

/**
 * Raw-row layer. Maps a provider_blocks row from GET /me/blocks into the
 * BlockedDate shape the UI uses. Returns null for a row with no usable start
 * timestamp so callers can filter it out rather than crash the whole map.
 *
 * The server returns startAt/endAt; the declared AvailabilityBlock type still
 * says startDate/endDate, so both shapes are read and the row is cast locally
 * rather than changing the shared type.
 */
export function mapProviderBlockToBlockedDate(raw: unknown): BlockedDate | null {
  const b = raw as any;
  const startAt: string | undefined = b?.startAt ?? b?.startDate;
  const endAt: string | undefined = b?.endAt ?? b?.endDate;
  if (!startAt) return null;

  const fullDay = isFullDaySpan(startAt, endAt);
  return {
    id: b.id,
    date: startAt.split("T")[0],
    isFullDay: fullDay,
    startTime: fullDay ? undefined : startAt.split("T")[1]?.substring(0, 5),
    endTime: fullDay ? undefined : endAt?.split("T")[1]?.substring(0, 5),
    reason: b.reason,
  };
}

export function formatTimeDisplay(time: string): string {
  const [hourStr, minStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const min = minStr;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${min} ${period}`;
}
