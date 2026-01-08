/**
 * Date utility functions for compliance calculations
 */

export const isWorkingDay = (date: Date, workingDays?: {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}): boolean => {
  if (!workingDays) {
    // Default: Monday-Friday
    const day = date.getDay();
    return day >= 1 && day <= 5;
  }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()] as keyof typeof workingDays;
  return workingDays[dayName] || false;
};

export const getWorkingDaysBetween = (
  startDate: Date,
  endDate: Date,
  workingDays?: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  }
): number => {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (isWorkingDay(current, workingDays)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const endOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

