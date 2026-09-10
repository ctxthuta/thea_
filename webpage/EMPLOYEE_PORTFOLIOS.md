# Employee Portfolio System Documentation

## Overview
This system creates hidden employee portfolio pages that can be accessed via business cards with UTM tracking. The pages are not indexed by search engines and are intended for direct sharing through physical business cards.

## Features
- **Hidden Pages**: Portfolios are set to `noindex` to prevent search engine indexing
- **UTM Tracking**: Business cards can include UTM parameters to track referrals
- **Mixpanel Analytics**: Comprehensive event tracking for QR scans, link clicks, and user interactions
- **Exclusive Link Previews**: Rich Open Graph and Twitter card metadata for social sharing
- **External Image Support**: Profile images can be hosted externally
- **Comprehensive Profiles**: Includes name, title, bio, education, experience, skills, certifications, contact info, social links, and projects
- **Professional Design**: Clean, modern UI with responsive layout

## Link Previews & Metadata

Each portfolio page includes exclusive metadata for rich link previews on social platforms:

### Open Graph (Facebook, LinkedIn, etc.)
- **Title**: Employee name and title
- **Description**: Professional bio
- **Image**: Profile picture (1200x630 recommended)
- **Type**: Profile
- **URL**: Clean portfolio URL

### Twitter Cards
- **Card Type**: Summary large image
- **Title**: Employee name and title
- **Description**: Professional bio
- **Image**: Profile picture

### Custom Metadata
- `employee:id`: Employee identifier
- `employee:name`: Full name
- `employee:title`: Job title

This ensures that when someone shares a portfolio link on social media, it displays a professional preview with the employee's photo and key information.

## URL Structure

### Direct Access
```
https://theasolutions.co/{employee-id}
```

### With UTM Tracking (Business Card)
```
https://theasolutions.co/{employee-id}?utm_source={employee-id}-card&utm_medium=business-card
```

## Business Card Setup

### UTM Parameter Format
When creating business cards, use the following UTM parameters:

- **utm_source**: `{employee-id}-card` (e.g., `john-doe-card`)
- **utm_medium**: `business-card`

### Example Business Card URLs
For employee "Dr. Ohnmar Than" (ID: `dr-ohnmar-than`):
```
https://theasolutions.co/dr-ohnmar-than?utm_source=dr-ohnmar-than-card&utm_medium=business-card
```

For employee "Thiri Chan Nyein" (ID: `thiri-chan-nyein`):
```
https://theasolutions.co/thiri-chan-nyein?utm_source=thiri-chan-nyein-card&utm_medium=business-card
```

## Adding New Employees

### 1. Add Employee Data
Edit `src/lib/employeeData.ts` and add a new employee to the `employees` array:

```typescript
{
  id: "new-employee-id",
  name: "Employee Name",
  title: "Job Title",
  profileImage: "https://your-external-host.com/profiles/new-employee-id.jpg", // External URL
  bio: "Short professional bio...",
  education: [...],
  experience: [...],
  skills: [...],
  certifications: [...],
  contact: {...},
  socialLinks: {...},
  projects: [...]
}
```

### 2. Add Profile Image
Use external hosting for profile images. The system supports:
- External URLs (starting with `http://` or `https://`)
- Local images in `public/employees/` (legacy support)

### 3. Create Business Card
Generate a QR code or print the URL with UTM parameters on their business card:
```
https://theasolutions.co/dr-ohnmar-than?utm_source=dr-ohnmar-than-card&utm_medium=business-card
```

## Employee Data Structure

### Required Fields
- `id`: Unique identifier (used in URL)
- `name`: Full name
- `title`: Job title
- `profileImage`: Path to profile image (or null for initials fallback)
- `bio`: Short professional biography
- `education`: Array of education objects
- `experience`: Array of work experience objects
- `skills`: Array of technical skills

### Optional Fields
- `certifications`: Array of certification objects
- `contact`: Contact information object
- `socialLinks`: Social media links object
- `projects`: Array of featured projects

## Mixpanel Analytics Integration

The system includes comprehensive Mixpanel event tracking. All events include employee information and UTM parameters when available.

### Tracked Events

#### 1. Employee Portfolio Viewed
Tracked when someone visits an employee portfolio page.
```typescript
{
  employee_id: string,
  employee_name: string,
  employee_title: string,
  utm_source: string | undefined,
  utm_medium: string | undefined,
  utm_campaign: string | undefined,
  is_qr_scan: boolean,
  referrer: string | undefined,
  page_url: string,
  timestamp: string
}
```

#### 2. QR Code Scanned
Tracked specifically when a user comes from a business card (utm_medium=business-card).
```typescript
{
  employee_id: string,
  employee_name: string,
  employee_title: string,
  utm_source: string,
  utm_medium: string,
  utm_campaign: string | undefined,
  scan_source: 'business_card',
  referrer: string | undefined,
  page_url: string,
  timestamp: string
}
```

#### 3. Social Link Clicked
Tracked when users click on social media links.
```typescript
{
  employee_id: string,
  employee_name: string,
  platform: 'linkedin' | 'github' | 'twitter' | 'website',
  url: string,
  utm_source: string | undefined,
  timestamp: string
}
```

#### 4. Contact Info Clicked
Tracked when users click on contact information.
```typescript
{
  employee_id: string,
  employee_name: string,
  contact_type: 'email' | 'phone',
  value: string,
  utm_source: string | undefined,
  timestamp: string
}
```

#### 5. Project Viewed
Tracked when users click on project links.
```typescript
{
  employee_id: string,
  employee_name: string,
  project_name: string,
  project_url: string,
  technologies: string[],
  utm_source: string | undefined,
  timestamp: string
}
```

#### 6. Certification Viewed
Tracked when users click on certification credential links.
```typescript
{
  employee_id: string,
  employee_name: string,
  certification_name: string,
  certification_issuer: string,
  credential_url: string,
  utm_source: string | undefined,
  timestamp: string
}
```

### Mixpanel Setup
Ensure your `.env` file contains:
```
NEXT_PUBLIC_MIXPANEL_TOKEN=your_mixpanel_token_here
```

The Mixpanel initialization is handled automatically in the portfolio page component.

## Security Considerations

- Pages are hidden from search engines via `robots: { index: false }`
- Access is not password-protected (add authentication if needed)
- UTM parameters are logged for tracking but not used for access control
- Consider adding employee-specific authentication if enhanced security is needed

## Customization

### Styling
The portfolio uses Tailwind CSS classes. Customize colors and spacing in:
- `src/app/[id]/page.tsx`

### Layout
Modify the component structure in the page file to reorganize sections or add new ones.

### Additional Sections
Add new sections by extending the `Employee` interface in `employeeData.ts` and updating the page component.

## Testing

### Test URLs
1. Direct access: `http://localhost:3000/dr-ohnmar-than`
2. With UTM: `http://localhost:3000/dr-ohnmar-than?utm_source=dr-ohnmar-than-card&utm_medium=business-card`
3. Second employee: `http://localhost:3000/thiri-chan-nyein?utm_source=thiri-chan-nyein-card&utm_medium=business-card`
4. Invalid employee: `http://localhost:3000/non-existent`

### Expected Behavior
- Valid employee: Shows portfolio with all sections
- UTM parameters: Shows "Business Card Verified" badge and logs parameters
- Invalid employee: Shows "Employee Not Found" message
- No profile image: Shows initials in a colored circle

## Troubleshooting

### Images Not Loading
- For external URLs: Ensure the URL is accessible and returns a valid image
- For local images: Ensure images are in `public/employees/` directory
- Check filename matches the `profileImage` path in employee data
- Verify image format (JPG/PNG)
- Check browser console for 404 errors

### UTM Not Working
- Check that UTM parameters are properly formatted
- Verify the `utm_source` matches the employee ID (with optional `-card` suffix)
- Check browser console for logged UTM parameters and Mixpanel events
- Ensure Mixpanel token is set in `.env` file

### Mixpanel Events Not Firing
- Verify `NEXT_PUBLIC_MIXPANEL_TOKEN` is set in `.env` file
- Check browser console for Mixpanel initialization errors
- Ensure Mixpanel token is valid and project is active
- Check network tab for failed Mixpanel API calls

### Pages Still Indexed
- Clear search engine cache
- Verify `robots: { index: false }` is set in layout metadata
- Check that pages are not linked from public pages
- Use robots.txt to disallow the dynamic route

## Future Enhancements

- Add password protection for individual portfolios
- Implement employee self-service profile editing
- Add portfolio download as PDF feature
- Create business card QR code generator
- Add multilingual support
- Implement vCard download functionality