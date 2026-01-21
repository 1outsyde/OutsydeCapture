import express from 'express';
import cors from 'cors';
import { googleCalendarService } from './calendarService';

const app = express();
const PORT = process.env.CALENDAR_API_PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/calendar/status', async (req, res) => {
  try {
    const connected = await googleCalendarService.isConnected();
    res.json({ connected });
  } catch (error) {
    res.json({ connected: false });
  }
});

app.get('/api/calendar/calendars', async (req, res) => {
  try {
    const calendars = await googleCalendarService.listCalendars();
    res.json({ calendars });
  } catch (error) {
    console.error('Failed to list calendars:', error);
    res.status(500).json({ error: 'Failed to list calendars' });
  }
});

app.post('/api/calendar/events', async (req, res) => {
  try {
    const { calendarId, ...sessionData } = req.body;
    const eventId = await googleCalendarService.createSessionEvent(sessionData, calendarId || 'primary');
    
    if (eventId) {
      res.json({ success: true, eventId });
    } else {
      res.status(500).json({ success: false, error: 'Failed to create event' });
    }
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

app.delete('/api/calendar/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { calendarId } = req.query;
    const success = await googleCalendarService.cancelSessionEvent(eventId, (calendarId as string) || 'primary');
    res.json({ success });
  } catch (error) {
    console.error('Failed to cancel calendar event:', error);
    res.status(500).json({ error: 'Failed to cancel calendar event' });
  }
});

app.get('/api/calendar/events', async (req, res) => {
  try {
    const { calendarId, maxResults } = req.query;
    const events = await googleCalendarService.getUpcomingEvents(
      (calendarId as string) || 'primary',
      maxResults ? parseInt(maxResults as string) : 10
    );
    res.json({ events });
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

app.get('/api/calendar/availability', async (req, res) => {
  try {
    const { date, startTime, endTime, calendarId } = req.query;
    
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const available = await googleCalendarService.checkAvailability(
      date as string,
      startTime as string,
      endTime as string,
      (calendarId as string) || 'primary'
    );
    res.json({ available });
  } catch (error) {
    console.error('Failed to check availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Calendar API server running on port ${PORT}`);
  });
}

export default app;
