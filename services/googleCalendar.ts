import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

async function getUncachableGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: string[];
}

export interface SessionCalendarData {
  photographerName: string;
  sessionType: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes?: string;
  photographerEmail?: string;
  clientEmail?: string;
}

class GoogleCalendarService {
  async isConnected(): Promise<boolean> {
    try {
      await getAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  async listCalendars(): Promise<{ id: string; summary: string }[]> {
    const calendar = await getUncachableGoogleCalendarClient();
    const response = await calendar.calendarList.list();
    return (response.data.items || []).map(cal => ({
      id: cal.id || '',
      summary: cal.summary || 'Unnamed Calendar'
    }));
  }

  async createSessionEvent(sessionData: SessionCalendarData, calendarId: string = 'primary'): Promise<string | null> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      const startDateTime = this.buildDateTime(sessionData.date, sessionData.startTime);
      const endDateTime = this.buildDateTime(sessionData.date, sessionData.endTime);
      
      const attendees: { email: string }[] = [];
      if (sessionData.photographerEmail) {
        attendees.push({ email: sessionData.photographerEmail });
      }
      if (sessionData.clientEmail) {
        attendees.push({ email: sessionData.clientEmail });
      }

      const event = {
        summary: `Outsyde Session: ${sessionData.sessionType} with ${sessionData.photographerName}`,
        description: this.buildDescription(sessionData),
        location: sessionData.location,
        start: {
          dateTime: startDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDateTime,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        attendees: attendees.length > 0 ? attendees : undefined,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
        colorId: '6',
      };

      const response = await calendar.events.insert({
        calendarId,
        requestBody: event,
        sendUpdates: attendees.length > 0 ? 'all' : 'none',
      });

      return response.data.id || null;
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      return null;
    }
  }

  async updateSessionEvent(
    eventId: string, 
    sessionData: Partial<SessionCalendarData>, 
    calendarId: string = 'primary'
  ): Promise<boolean> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      const existingEvent = await calendar.events.get({
        calendarId,
        eventId,
      });

      const updates: any = {};
      
      if (sessionData.date && sessionData.startTime) {
        updates.start = {
          dateTime: this.buildDateTime(sessionData.date, sessionData.startTime),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }
      
      if (sessionData.date && sessionData.endTime) {
        updates.end = {
          dateTime: this.buildDateTime(sessionData.date, sessionData.endTime),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }
      
      if (sessionData.location) {
        updates.location = sessionData.location;
      }

      await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: {
          ...existingEvent.data,
          ...updates,
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      return false;
    }
  }

  async cancelSessionEvent(eventId: string, calendarId: string = 'primary'): Promise<boolean> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: {
          status: 'cancelled',
        },
        sendUpdates: 'all',
      });

      return true;
    } catch (error) {
      console.error('Failed to cancel calendar event:', error);
      return false;
    }
  }

  async deleteSessionEvent(eventId: string, calendarId: string = 'primary'): Promise<boolean> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      await calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: 'all',
      });

      return true;
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      return false;
    }
  }

  async getUpcomingEvents(calendarId: string = 'primary', maxResults: number = 10): Promise<CalendarEvent[]> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      const response = await calendar.events.list({
        calendarId,
        timeMin: new Date().toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return (response.data.items || []).map(event => ({
        id: event.id || undefined,
        title: event.summary || 'Untitled Event',
        description: event.description || undefined,
        startTime: event.start?.dateTime || event.start?.date || '',
        endTime: event.end?.dateTime || event.end?.date || '',
        location: event.location || undefined,
        attendees: event.attendees?.map(a => a.email || '').filter(Boolean),
      }));
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
      return [];
    }
  }

  async checkAvailability(
    date: string, 
    startTime: string, 
    endTime: string, 
    calendarId: string = 'primary'
  ): Promise<boolean> {
    try {
      const calendar = await getUncachableGoogleCalendarClient();
      
      const startDateTime = this.buildDateTime(date, startTime);
      const endDateTime = this.buildDateTime(date, endTime);

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: startDateTime,
          timeMax: endDateTime,
          items: [{ id: calendarId }],
        },
      });

      const busySlots = response.data.calendars?.[calendarId]?.busy || [];
      return busySlots.length === 0;
    } catch (error) {
      console.error('Failed to check availability:', error);
      return true;
    }
  }

  private buildDateTime(date: string, time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const dateObj = new Date(date);
    dateObj.setHours(hours, minutes, 0, 0);
    return dateObj.toISOString();
  }

  private buildDescription(sessionData: SessionCalendarData): string {
    const lines = [
      `Photography Session with ${sessionData.photographerName}`,
      '',
      `Session Type: ${sessionData.sessionType}`,
      `Location: ${sessionData.location}`,
    ];

    if (sessionData.notes) {
      lines.push('', `Notes: ${sessionData.notes}`);
    }

    lines.push(
      '',
      '---',
      'Booked via Outsyde',
      'https://outsyde.app'
    );

    return lines.join('\n');
  }
}

export const googleCalendarService = new GoogleCalendarService();
export default googleCalendarService;
