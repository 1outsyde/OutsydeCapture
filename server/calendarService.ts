import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
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

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

async function getGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
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
  addReminders?: boolean;
  invitePhotographer?: boolean;
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
    const calendar = await getGoogleCalendarClient();
    const response = await calendar.calendarList.list();
    return (response.data.items || []).map(cal => ({
      id: cal.id || '',
      summary: cal.summary || 'Unnamed Calendar'
    }));
  }

  async createSessionEvent(sessionData: SessionCalendarData, calendarId: string = 'primary'): Promise<string | null> {
    try {
      const calendar = await getGoogleCalendarClient();
      
      const startDateTime = this.buildDateTime(sessionData.date, sessionData.startTime);
      const endDateTime = this.buildDateTime(sessionData.date, sessionData.endTime);
      
      const attendees: { email: string }[] = [];
      if (sessionData.invitePhotographer && sessionData.photographerEmail) {
        attendees.push({ email: sessionData.photographerEmail });
      }
      if (sessionData.clientEmail) {
        attendees.push({ email: sessionData.clientEmail });
      }

      const reminders = sessionData.addReminders !== false ? {
        useDefault: false,
        overrides: [
          { method: 'email' as const, minutes: 24 * 60 },
          { method: 'popup' as const, minutes: 60 },
          { method: 'popup' as const, minutes: 15 },
        ],
      } : { useDefault: true };

      const event = {
        summary: `Outsyde: ${sessionData.sessionType} with ${sessionData.photographerName}`,
        description: this.buildDescription(sessionData),
        location: sessionData.location,
        start: {
          dateTime: startDateTime,
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'America/New_York',
        },
        attendees: attendees.length > 0 ? attendees : undefined,
        reminders,
        colorId: '6',
      };

      const response = await calendar.events.insert({
        calendarId,
        requestBody: event,
        sendUpdates: attendees.length > 0 ? 'all' : 'none',
      });

      console.log('Calendar event created:', response.data.id);
      return response.data.id || null;
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      return null;
    }
  }

  async cancelSessionEvent(eventId: string, calendarId: string = 'primary'): Promise<boolean> {
    try {
      const calendar = await getGoogleCalendarClient();
      
      await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: {
          status: 'cancelled',
        },
        sendUpdates: 'all',
      });

      console.log('Calendar event cancelled:', eventId);
      return true;
    } catch (error) {
      console.error('Failed to cancel calendar event:', error);
      return false;
    }
  }

  async getUpcomingEvents(calendarId: string = 'primary', maxResults: number = 10): Promise<any[]> {
    try {
      const calendar = await getGoogleCalendarClient();
      
      const response = await calendar.events.list({
        calendarId,
        timeMin: new Date().toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return (response.data.items || []).map(event => ({
        id: event.id,
        title: event.summary || 'Untitled Event',
        description: event.description,
        startTime: event.start?.dateTime || event.start?.date,
        endTime: event.end?.dateTime || event.end?.date,
        location: event.location,
        attendees: event.attendees?.map(a => a.email).filter(Boolean),
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
      const calendar = await getGoogleCalendarClient();
      
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
    const timeParts = time.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
    if (!timeParts) {
      const dateObj = new Date(date);
      dateObj.setHours(12, 0, 0, 0);
      return dateObj.toISOString();
    }

    let hours = parseInt(timeParts[1]);
    const minutes = parseInt(timeParts[2] || '0');
    const meridiem = timeParts[3]?.toUpperCase();

    if (meridiem === 'PM' && hours !== 12) {
      hours += 12;
    } else if (meridiem === 'AM' && hours === 12) {
      hours = 0;
    }

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
      'Booked via Outsyde'
    );

    return lines.join('\n');
  }
}

export const googleCalendarService = new GoogleCalendarService();
