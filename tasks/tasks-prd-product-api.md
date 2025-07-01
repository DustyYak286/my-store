## Relevant Files

- `src/app/api/products/route.js` - The API route handler for serving product data.
- `src/app/api/products/data.js` - A file to store the product data as a JSON object.
- `src/components/ProductDetails.tsx` - The frontend component that will fetch and display the product data.

### Notes

- Unit tests should typically be placed alongside the code files they are testing.
- Use `npm test` to run tests.

## Tasks

- [x] 1.0 Create the basic structure for the Product API.
  - [x] 1.1 Create the directory `src/app/api/products`.
  - [x] 1.2 Create the file `src/app/api/products/data.js` and populate it with initial product data.
  - [x] 1.3 Create the file `src/app/api/products/route.js`.
- [x] 2.0 Implement the GET endpoint to fetch all products.
  - [x] 2.1 In `route.js`, import the product data from `data.js`.
  - [x] 2.2 Implement the `GET` function to return all products as a JSON response.
- [x] 3.0 Refactor the `ProductDetails` component to fetch data from the new API.
  - [x] 3.1 Modify `ProductDetails.tsx` to use `useEffect` and `useState` hooks to fetch and store product data.
  - [x] 3.2 Replace the hardcoded product information with the data fetched from the API.
- [x] 4.0 Add a GET endpoint to fetch a single product by ID.
  - [x] 4.1 Modify the `GET` function in `route.js` to handle requests for a single product by ID.
  - [x] 4.2 Update the `ProductDetails.tsx` component to fetch a single product.
- [ ] 5.0 Clean up and finalize the implementation.
  - [x] 5.1 Remove any unused or commented-out code.
  - [x] 5.2 Ensure the code is well-formatted and adheres to project conventions.
