
How to update patch cateories


1. Edit and save category_list.xlsx
2. Run

   node patch_cats

3. check in and push

patch_cats.js recalculates new category file from the spreadsheet and it to the /assets directory. These are static files that are checked in, so simply pushing to production makes the new categories visible.
