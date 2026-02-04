 Plan to implement                                                                                                    │
│                                                                                                                      │
│ Implementation Plan: Meetings, Calendar, Testing & Todo Enhancements                                                 │
│                                                                                                                      │
│ Overview                                                                                                             │
│                                                                                                                      │
│ Add 5 major features to the FuelServicePro Project Estimator:                                                        │
│ 1. Meetings Page - Schedule meetings with invite links & calendar integration                                        │
│ 2. Project Calendar - Visual monthly calendar showing all scheduled dates                                            │
│ 3. Critical Junctures - Track days requiring AB supervision licensing                                                │
│ 4. Testing & Calibration Page - Post-install testing with 4 sections                                                 │
│ 5. Todo Enhancements - Add priority (P1-P4) and optional deadline                                                    │
│                                                                                                                      │
│ ---                                                                                                                  │
│ Files to Modify                                                                                                      │
│ ┌──────────────────────┬──────────────────────────────────────────────────────────┐                                  │
│ │         File         │                         Changes                          │                                  │
│ ├──────────────────────┼──────────────────────────────────────────────────────────┤                                  │
│ │ api/index.js         │ Add 6 new JSONB columns, update POST/PUT/GET endpoints   │                                  │
│ ├──────────────────────┼──────────────────────────────────────────────────────────┤                                  │
│ │ public/js/app.js     │ Add data structures, rendering functions, calendar logic │                                  │
│ ├──────────────────────┼──────────────────────────────────────────────────────────┤                                  │
│ │ public/index.html    │ Add 3 new tabs (Meetings, Calendar, Testing)             │                                  │
│ ├──────────────────────┼──────────────────────────────────────────────────────────┤                                  │
│ │ public/css/style.css │ Calendar grid, priority badges, testing status styles    │                                  │
│ └──────────────────────┴──────────────────────────────────────────────────────────┘                                  │
│ ---                                                                                                                  │
│ 1. Database Schema (api/index.js)                                                                                    │
│                                                                                                                      │
│ New JSONB Columns                                                                                                    │
│                                                                                                                      │
│ meetings JSONB DEFAULT '[]'                                                                                          │
│ -- [{ id, title, datetime, location, notes, createdAt }]                                                             │
│                                                                                                                      │
│ section_meetings JSONB DEFAULT '{}'                                                                                  │
│ -- { 'Package Name': [meeting objects] }                                                                             │
│                                                                                                                      │
│ critical_junctures JSONB DEFAULT '[]'                                                                                │
│ -- [{ id, date, description, assignedPerson, createdAt }]                                                            │
│                                                                                                                      │
│ testing_calibration JSONB DEFAULT '{}'                                                                               │
│ -- { 'Section Name': { lineItems: [{ id, description, qty, cost, price, status }] } }                                │
│                                                                                                                      │
│ testing_assignments JSONB DEFAULT '{}'                                                                               │
│ -- { 'Section Name': 'Company Name' }                                                                                │
│                                                                                                                      │
│ testing_schedules JSONB DEFAULT '{}'                                                                                 │
│ -- { 'Section Name': { scheduledDate, startDate, endDate } }                                                         │
│                                                                                                                      │
│ ---                                                                                                                  │
│ 2. Testing & Calibration Page                                                                                        │
│                                                                                                                      │
│ Fixed Sections (not dynamic like Equipment Packages)                                                                 │
│                                                                                                                      │
│ - Dispenser Calibrations                                                                                             │
│ - UDC and STP Sump Testing                                                                                           │
│ - Line Testing                                                                                                       │
│ - Tank Testing                                                                                                       │
│                                                                                                                      │
│ Each Section Has:                                                                                                    │
│                                                                                                                      │
│ - Header: Section name + assigned company badge + schedule button                                                    │
│ - Company Assignment: Click to edit (like contractor assignment pattern)                                             │
│ - Schedule: Single date OR date window (start/end)                                                                   │
│ - Line Items: Full pricing like Equipment Packages                                                                   │
│   - Description, Qty, Cost, Unit Price, Total                                                                        │
│   - Status column (Pending/Scheduled/Completed)                                                                      │
│   - Section totals (Cost, Profit, Total)                                                                             │
│ - Add Item Button: Add tests/calibrations to track                                                                   │
│                                                                                                                      │
│ Line Item Structure                                                                                                  │
│                                                                                                                      │
│ {                                                                                                                    │
│     id: Date.now(),                                                                                                  │
│     description: "Dispenser calibration - pump 1",                                                                   │
│     qty: 1,                                                                                                          │
│     cost: 150.00,                                                                                                    │
│     price: 200.00,                                                                                                   │
│     status: "pending" // pending | scheduled | completed                                                             │
│ }                                                                                                                    │
│                                                                                                                      │
│ ---                                                                                                                  │
│ 3. Meetings Page                                                                                                     │
│                                                                                                                      │
│ Structure                                                                                                            │
│                                                                                                                      │
│ - General Meetings: Project-wide meetings list                                                                       │
│ - Critical Junctures: Red-highlighted section for AB supervision days                                                │
│ - Package Meetings: Meetings per equipment package (like scope/disclaimers pattern)                                  │
│                                                                                                                      │
│ Each Meeting Has:                                                                                                    │
│                                                                                                                      │
│ - Title, Date/Time, Location, Notes                                                                                  │
│ - Share Invite Link - Generates short URL (like contractor links) that opens meeting details in app                  │
│ - Add to Google Calendar - Opens gcal with pre-filled event                                                          │
│ - Download .ics - For Outlook/Apple Calendar                                                                         │
│                                                                                                                      │
│ Invite Link System                                                                                                   │
│                                                                                                                      │
│ - New meeting_links table (similar to contractor_links)                                                              │
│ - Short code generation: /m/{shortCode}                                                                              │
│ - Link opens read-only meeting view with all details                                                                 │
│ - Copy button copies link to clipboard                                                                               │
│                                                                                                                      │
│ Calendar URL Generation                                                                                              │
│                                                                                                                      │
│ // Google Calendar                                                                                                   │
│ https://calendar.google.com/calendar/render?action=TEMPLATE&text=Title&dates=START/END&details=Notes&location=Locati │
│ on                                                                                                                   │
│                                                                                                                      │
│ // iCal file download (for Outlook/Apple)                                                                            │
│ BEGIN:VCALENDAR...END:VCALENDAR                                                                                      │
│                                                                                                                      │
│ ---                                                                                                                  │
│ 4. Project Calendar                                                                                                  │
│                                                                                                                      │
│ Monthly Grid View                                                                                                    │
│                                                                                                                      │
│ - 7-column grid (Sun-Sat)                                                                                            │
│ - Navigation: Previous/Next month buttons                                                                            │
│ - Today highlighted with border                                                                                      │
│                                                                                                                      │
│ Event Sources (color-coded dots)                                                                                     │
│                                                                                                                      │
│ - Blue: Meetings                                                                                                     │
│ - Green: Testing schedules                                                                                           │
│ - Red: Critical Junctures                                                                                            │
│ - Orange: Todo deadlines                                                                                             │
│                                                                                                                      │
│ Click Day -> Modal showing all events for that date                                                                  │
│                                                                                                                      │
│ ---                                                                                                                  │
│ 5. Todo Enhancements                                                                                                 │
│                                                                                                                      │
│ New Fields                                                                                                           │
│                                                                                                                      │
│ {                                                                                                                    │
│     id: Date.now(),                                                                                                  │
│     text: "Task description",                                                                                        │
│     priority: "P3",        // REQUIRED: P1, P2, P3, P4 (default: P3)                                                 │
│     deadline: null,        // OPTIONAL: "2024-03-15" date string                                                     │
│     completed: false,                                                                                                │
│     completedAt: null                                                                                                │
│ }                                                                                                                    │
│                                                                                                                      │
│ Priority Colors & Labels                                                                                             │
│                                                                                                                      │
│ - P1 (Urgent): Red #dc3545 - "Critical, needs immediate attention"                                                   │
│ - P2 (High): Orange #f59e0b - "Important, address soon"                                                              │
│ - P3 (Normal): Blue #3b82f6 - "Standard priority" (DEFAULT)                                                          │
│ - P4 (Low): Gray #6b7280 - "When time permits"                                                                       │
│                                                                                                                      │
│ Display Changes                                                                                                      │
│                                                                                                                      │
│ - Priority badge next to todo text                                                                                   │
│ - Deadline shown if present                                                                                          │
│ - Overdue warning (red) if deadline passed                                                                           │
│ - Sort by priority, then deadline                                                                                    │
│                                                                                                                      │
│ ---                                                                                                                  │
│ 6. Implementation Order                                                                                              │
│                                                                                                                      │
│ Phase 1: Database & API                                                                                              │
│                                                                                                                      │
│ 1. Add 6 new JSONB columns with migrations                                                                           │
│ 2. Update POST endpoint (add new fields)                                                                             │
│ 3. Update PUT endpoint (add new fields)                                                                              │
│ 4. Update GET endpoint (return new fields)                                                                           │
│                                                                                                                      │
│ Phase 2: Todo Enhancements                                                                                           │
│                                                                                                                      │
│ 1. Update todo data structure                                                                                        │
│ 2. Create add/edit modal with priority dropdown + deadline picker                                                    │
│ 3. Update rendering with priority badges and deadline display                                                        │
│ 4. Add overdue warning styling                                                                                       │
│                                                                                                                      │
│ Phase 3: Testing & Calibration Page                                                                                  │
│                                                                                                                      │
│ 1. Add HTML tab structure                                                                                            │
│ 2. Create renderTestingSections() function                                                                           │
│ 3. Implement company assignment (reuse contractor pattern)                                                           │
│ 4. Implement schedule editing (date or date range modal)                                                             │
│ 5. Implement line items with status tracking                                                                         │
│                                                                                                                      │
│ Phase 4: Meetings Page                                                                                               │
│                                                                                                                      │
│ 1. Add HTML tab structure                                                                                            │
│ 2. Create renderMeetings(), addMeeting() functions                                                                   │
│ 3. Create renderCriticalJunctures(), addCriticalJuncture()                                                           │
│ 4. Implement Google Calendar URL generation                                                                          │
│ 5. Implement iCal file download                                                                                      │
│                                                                                                                      │
│ Phase 5: Project Calendar                                                                                            │
│                                                                                                                      │
│ 1. Add HTML tab structure with calendar grid                                                                         │
│ 2. Create renderCalendar() function                                                                                  │
│ 3. Aggregate events from all sources                                                                                 │
│ 4. Implement month navigation                                                                                        │
│ 5. Implement day-click event modal                                                                                   │
│                                                                                                                      │
│ Phase 6: Integration                                                                                                 │
│                                                                                                                      │
│ 1. Update save/load functions for new data                                                                           │
│ 2. Add switchTab() handlers for new tabs                                                                             │
│ 3. Test contractor mode filtering                                                                                    │
│ 4. Add TabSync for new data types                                                                                    │
│                                                                                                                      │
│ ---                                                                                                                  │
│ 7. Key Functions to Create                                                                                           │
│                                                                                                                      │
│ app.js Additions                                                                                                     │
│                                                                                                                      │
│ // Testing & Calibration                                                                                             │
│ TESTING_SECTIONS: ['Dispenser Calibrations', 'UDC and STP Sump Testing', 'Line Testing', 'Tank Testing']             │
│ renderTestingSections()                                                                                              │
│ editTestingCompany(sectionName)                                                                                      │
│ editTestingSchedule(sectionName)                                                                                     │
│ addTestingLineItem(sectionName)                                                                                      │
│ updateTestingItemStatus(sectionName, index, status)                                                                  │
│                                                                                                                      │
│ // Meetings                                                                                                          │
│ renderMeetings()                                                                                                     │
│ renderGeneralMeetings()                                                                                              │
│ renderSectionMeetings()                                                                                              │
│ renderCriticalJunctures()                                                                                            │
│ addMeeting(type, sectionName?)                                                                                       │
│ addCriticalJuncture()                                                                                                │
│ generateGoogleCalendarUrl(meeting)                                                                                   │
│ generateICalFile(meeting)                                                                                            │
│                                                                                                                      │
│ // Calendar                                                                                                          │
│ calendarDate: new Date()                                                                                             │
│ renderCalendar()                                                                                                     │
│ previousMonth()                                                                                                      │
│ nextMonth()                                                                                                          │
│ getEventsForDate(date)                                                                                               │
│ showDayEvents(date)                                                                                                  │
│                                                                                                                      │
│ // Todo (modify existing)                                                                                            │
│ showAddTodoModal(type, sectionName?)  // Replace prompt()                                                            │
│                                                                                                                      │
│ ---                                                                                                                  │
│ 8. Verification                                                                                                      │
│                                                                                                                      │
│ 1. Testing Page: Add line items, assign company, set schedule, change status                                         │
│ 2. Meetings: Create meeting, share link, add to Google Calendar, download .ics                                       │
│ 3. Critical Junctures: Add juncture, verify shows on calendar in red                                                 │
│ 4. Calendar: Navigate months, see all event types, click day for details                                             │
│ 5. Todos: Add with priority/deadline, verify colors and sorting  