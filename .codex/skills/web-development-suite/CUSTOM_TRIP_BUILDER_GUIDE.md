# AI Custom Trip Builder - Feature Guide

## Overview
The AI Custom Trip Builder allows travelers to create personalized trip itineraries through a conversational questionnaire interface. Users can save their custom trips to their profile for later reference, editing, or conversion to actual bookings.

## Files Created

### 1. **Hook** - State Management
- **File**: `src/hooks/useCustomTrip.js`
- **Purpose**: Manages trip data state, question flow, and trip generation
- **Exports**:
  - `tripData`: Current trip answers
  - `updateTripData()`: Update specific answer
  - `currentQuestion`: Current question index
  - `questions`: Array of 12 questions
  - `nextQuestion()`: Move to next question
  - `prevQuestion()`: Move to previous question
  - `resetTrip()`: Clear all data
  - `showPreview`: Boolean for preview state
  - `showTripBuilder`: Boolean for modal visibility
  - `generateTripObject()`: Create final trip object for saving

### 2. **Component** - Question Flow
- **File**: `src/components/ai/TripQuestionnaire.jsx`
- **Purpose**: Displays one question at a time with conversational UX
- **Features**:
  - Progress bar showing completion %
  - Text, number, and select input types
  - Question validation (required fields)
  - Navigation buttons (Back/Next)
  - Multi-language support (EN/FA/AR)

### 3. **Component** - Trip Preview
- **File**: `src/components/cards/TripPreviewCard.jsx`
- **Purpose**: Displays collected trip data in beautiful card format
- **Features**:
  - Shows all collected information
  - Organized info boxes (duration, budget, group size, etc.)
  - Special sections for health/dietary/notes
  - Edit and Save buttons
  - Loading state during save

### 4. **Component** - Trip Builder Modal
- **File**: `src/components/ai/TripBuilder.jsx`
- **Purpose**: Main wrapper component integrating questionnaire, preview, and save
- **Features**:
  - Modal UI with header and close button
  - Switches between questionnaire, preview, and saved states
  - Handles saving to Supabase
  - Shows confirmation message after save
  - Multi-language support

### 5. **Database** - Supabase Migration
- **File**: `supabase/migrations/add_custom_trips_table.sql`
- **Purpose**: Creates custom_trips table and RLS policies
- **Table Structure**:
  ```sql
  custom_trips (
    id UUID PRIMARY KEY,
    user_id UUID (foreign key to auth.users),
    trip_data JSONB (full trip object),
    status VARCHAR (draft/saved/booked/completed),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
  )
  ```
- **Security**: Row-level security enabled - users can only see/edit/delete their own trips

## Integration with AIAssistant

### How It Works:
1. User types "create custom trip", "plan trip", "custom trip", etc. in the chat
2. AIAssistant detects these keywords (in EN/FA/AR)
3. Sets `showTripBuilder = true`
4. TripBuilder modal opens
5. User goes through 12-question flow
6. Questionnaire transitions to preview
7. User clicks "Save to Profile"
8. Data saves to Supabase
9. Confirmation message shows
10. Modal closes automatically

### Keyword Detection:
```javascript
// English
'custom trip', 'create trip', 'plan trip', 'custom itinerary', 'build trip'

// Persian (فارسی)
'سفر سفارشی', 'سفر شخصی', 'برنامه‌ریزی سفر', 'ایجاد برنامه'

// Arabic (العربية)
'رحلة مخصصة', 'خطة رحلة', 'خطة سفر'
```

## 12 Questions Explained

### 1. **Destinations**
- Input: Text
- Stores city names as comma-separated list
- Converted to array when saving

### 2. **Duration**
- Input: Number
- Stored as integer
- Used in trip title generation

### 3. **Budget**
- Input: Text (auto-parses currency symbols)
- Detects USD ($) or IRR
- Stored as amount + currency

### 4. **Group Size**
- Input: Number
- Stored as integer
- Used for per-person budget calculations

### 5. **Children**
- Input: Yes/No format text
- Optionally stores count and ages
- Triggers special accommodation needs

### 6. **Travel Purpose**
- Input: Select from 10 options
- Determines itinerary recommendations
- Options: Cultural, Historical, Nature, Photography, Food, Spiritual, Adventure, Research, Family, Other

### 7. **Health Considerations**
- Input: Text (optional)
- Free-form input for medical/accessibility needs
- Displayed prominently in preview
- Helps create accessible itineraries

### 8. **Activity Level**
- Input: Select from 4 options
- Determines itinerary intensity
- Options: Light, Moderate, Adventurous, Mixed

### 9. **Dietary Preferences**
- Input: Select one or more
- Options: No restrictions, Vegetarian, Vegan, Halal, Kosher, Allergies, Other
- Helps plan restaurant selections

### 10. **Accommodation Type**
- Input: Select multiple
- Options: Luxury, Mid-range, Budget, Traditional, Eco-lodges, Mixed
- Influences itinerary and budget recommendations

### 11. **Pace Preference**
- Input: Select one
- Determines daily schedule intensity
- Options: Fast-paced, Relaxed, Balanced

### 12. **Additional Notes**
- Input: Text (optional)
- Free-form for special requests
- Final chance for user to add context

## Trip Object Structure

When saved, trip object looks like:
```javascript
{
  id: 'trip-1621234567890',
  createdAt: '2024-05-23T16:00:00Z',
  status: 'draft',
  title: '7-day trip to Isfahan, Shiraz',
  destinations: ['Isfahan', 'Shiraz'],
  duration: 7,
  budget: {
    amount: 1500,
    currency: 'USD',
    perPerson: true
  },
  groupSize: 4,
  children: {
    hasChildren: true,
    count: 2,
    ages: [6, 9]
  },
  purpose: 'Cultural exploration',
  activityLevel: 'Moderate',
  pace: 'Balanced',
  accommodation: ['Mid-range hotels', 'Traditional guesthouses'],
  dietary: ['Vegetarian'],
  healthConsiderations: {
    conditions: 'Mobility considerations',
    hasSpecialNeeds: true
  },
  notes: 'Family vacation looking for cultural experiences'
}
```

## Database Migration

To apply the migration:

### Using Supabase CLI:
```bash
supabase migration new add_custom_trips_table
# Edit the migration file with the SQL from supabase/migrations/add_custom_trips_table.sql
supabase migration up
```

### Or manually in Supabase Dashboard:
1. Go to SQL Editor
2. Create new query
3. Paste the SQL from `add_custom_trips_table.sql`
4. Run the query

## Testing the Feature

### Test Scenario 1: Basic Flow
1. Go to `/al-assistant`
2. Type: "I want to create a custom trip"
3. Answer all 12 questions
4. Review preview
5. Click "Save to Profile"
6. See confirmation message

### Test Scenario 2: Edit Before Save
1. Complete questionnaire
2. Reach preview
3. Click "Edit"
4. Go back to modify previous questions
5. Click "Next" to navigate to preview again
6. Save

### Test Scenario 3: Required Fields
1. Try clicking "Next" without answering a required question
2. Should show error: "This question is required"
3. Button should be disabled

### Test Scenario 4: Multi-language
1. Switch to Persian/Arabic in header
2. Type trip creation message in that language
3. Modal should open with all text translated
4. Save trip with non-English text

## Future Enhancements

1. **AI Itinerary Generation**
   - Generate day-by-day itinerary based on answers
   - Show recommended attractions, restaurants, hotels
   - Estimated costs and timing

2. **Trip Sharing**
   - Generate shareable link
   - Invite travel companions
   - Collaborative planning

3. **Booking Integration**
   - Convert custom trip to actual booking
   - Link to tours, guides, hotels
   - Payment processing

4. **Trip Timeline/Map**
   - Visual timeline of trip
   - Map showing route
   - Day-by-day breakdown

5. **Trip Editing**
   - View saved trips from profile
   - Edit existing trips
   - Delete trips
   - Regenerate recommendations

6. **Analytics**
   - Popular destinations
   - Average trip duration
   - Most common purposes
   - Budget trends

## Troubleshooting

### Issue: "This question is required" but field is filled
- **Solution**: Check that the field value is actually being stored in state. Look at browser DevTools to verify `tripData` updates.

### Issue: Trip not saving
- **Solution**: 
  1. Check user is logged in
  2. Verify Supabase connection
  3. Check RLS policies allow INSERT
  4. Look at browser console for errors

### Issue: Modal won't open
- **Solution**: 
  1. Verify keyword matches (case-sensitive on some checks)
  2. Check that `showTripBuilder` state is toggling
  3. Inspect React DevTools to see state changes

### Issue: Translations missing
- **Solution**: Add missing keys to all three language objects in question definitions (en, fa, ar)

## Code Examples

### Detecting Trip Creation Request:
```javascript
const wantsTripBuilder = 
  'create custom trip'.includes(userInput.toLowerCase()) ||
  'سفر سفارشی'.includes(userInput);

if (wantsTripBuilder) {
  setShowTripBuilder(true);
}
```

### Accessing Saved Trips:
```javascript
const { data: trips } = await supabase
  .from('custom_trips')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });
```

### Updating Trip Status:
```javascript
await supabase
  .from('custom_trips')
  .update({ status: 'saved' })
  .eq('id', tripId);
```

## Performance Considerations

1. **State Management**: Trip data kept in component state (not Redux) - fine for single user
2. **Database Queries**: 
   - Single INSERT on save
   - Simple SELECT by user_id
   - No complex joins needed
3. **Modal**: Uses Portal/Portal-like approach to avoid layout shift
4. **Animations**: Framer Motion with optimized transitions

## Accessibility

- ✅ Keyboard navigation (Enter to submit, Tab to move between inputs)
- ✅ Form labels and ARIA attributes
- ✅ Progress bar for context
- ✅ Error messages linked to inputs
- ✅ Color contrast meets WCAG standards
- ✅ Mobile responsive design

## Notes for Future Developers

1. All 12 questions are required unless marked `required: false`
2. The `generateTripObject()` function must be called before saving
3. Supabase RLS policies prevent users from viewing others' trips
4. Trip data is stored as JSONB - allows flexible schema changes
5. Status field can be: draft, saved, booked, completed
6. Always validate user is authenticated before saving

---

**Last Updated**: May 23, 2024
**Feature Status**: ✅ Complete - Ready for testing and integration
