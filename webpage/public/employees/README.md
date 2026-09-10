# Employee Profile Images

This directory supports local image hosting, but external hosting is recommended for better performance and CDN benefits.

## External Hosting (Recommended)
Update the `profileImage` field in `src/lib/employeeData.ts` with external URLs:
```typescript
profileImage: "https://your-cdn.com/profiles/john-doe.jpg"
```

## Local Hosting (Legacy Support)
Place employee profile images in this directory with the following naming convention:
- `{employee-id}.jpg` or `{employee-id}.png`

For example:
- `john-doe.jpg`
- `jane-smith.jpg`

## Image Specifications
- Recommended size: 400x400 pixels (for display), 1200x630 pixels (for social sharing)
- Format: JPG or PNG
- Professional headshot preferred
- Solid or neutral background works best

## Sample Structure
```
employees/
├── README.md
├── john-doe.jpg
├── jane-smith.jpg
└── ...
```

If no image is found for an employee, the system will display their initials instead.