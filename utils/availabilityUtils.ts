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

export function formatTimeDisplay(time: string): string {
  const [hourStr, minStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const min = minStr;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${min} ${period}`;
}
