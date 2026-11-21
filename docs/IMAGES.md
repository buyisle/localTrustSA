# Image sources and rights

The bundled homepage hero is an AI-generated editorial illustration of local home services. The people shown are illustrative. The eight `illustration-*.jpg` assets are generated category illustrations, covering plumbing, electrical, cleaning, painting, gardening, beauty, appliance repair and carpentry. These photos illustrate the kind of service on offer. Additional categories use matching local icon artwork by default. Optional Pexels downloads were blocked in this environment. Providers can set a public HTTPS profile photo URL using an image they have permission to publish.

`npm run assets:download` explicitly downloads candidate JPEGs into `client/public/images` and registers successful downloads in `client/src/assets/service-images.json`. Run it in an environment with outbound access, inspect every subject/crop, and rebuild. No CDN is needed at runtime. The script preserves prior registered local assets if later downloads fail.

| Local name | Candidate source |
| --- | --- |
| plumbing.jpg | https://www.pexels.com/photo/6419128/ |
| electrical.jpg | https://www.pexels.com/photo/8005368/ |
| cleaning.jpg | https://www.pexels.com/photo/crop-woman-dusting-lamp-during-housework-4239031/ |
| painting.jpg | https://www.pexels.com/photo/man-painting-the-wall-6474471/ |
| beauty.jpg | https://www.pexels.com/photo/3993449/ |
| gardening.jpg | https://www.pexels.com/photo/4503269/ |
| carpentry.jpg | https://www.pexels.com/photo/5974389/ |
| handyman.jpg | https://www.pexels.com/photo/4489732/ |

Source license: https://www.pexels.com/license/ and https://help.pexels.com/hc/en-us/articles/360042295174-What-is-the-license-of-the-photos-and-videos-on-Pexels

Pexels permits personal and commercial use under its license. Keep these source records and check each downloaded asset's source page and restrictions. Stock images illustrate a category; they do not depict or endorse the listed providers. The interface says this explicitly on profiles and in alt text. Specific appliance repair, HVAC, moving, car washing and other category photos still need separate selection; broad fallback mappings are provisional. No claim is made that the candidate subjects were visually verified in this environment.

To use your own licensed category asset, place it in `client/public/images`, record its source/creator/license here, add its `/images/...` path to the manifest, and set the matching category in `ServiceImage.tsx`. Providers can separately publish their own portfolio photos through their authenticated dashboard. Those files are stored in `server/uploads` and displayed as portfolio work, rather than stock category photos.
