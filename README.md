# הוראות חיבור ל-Google Sheets

## שלב 1 — צרו Google Sheet חדש
תנו שם, למשל: "מחסון הפקות".

## שלב 2 — הפעילו Apps Script
Extensions → Apps Script. הדביקו את התוכן של `Code.gs`, שמרו.
הריצו את הפונקציה `initSheets()` פעם אחת (ייצור גיליונות: Products, Events, Reservations, Settings).

## שלב 3 — Deploy כ-Web App
Deploy → New Deployment → Web app. הרשאות: anyone with the link.
העתיקו את ה-URL.

## שלב 4 — חברו את האפליקציה
ב-`src/data.jsx`, החליפו את ה-mock data בקריאת `fetch(WEB_APP_URL)`.

## סנכרון יומן
דף ההנחיה כולל כפתורים: Google Calendar ישיר + הורדת .ics לשליחה לעובדים (byoffice@by-p.com יוגדר כבעלים ברירת מחדל).
