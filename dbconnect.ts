import { createPool } from 'mysql2/promise';

// export const conn = createPool({
//     connectionLimit: 10,
//     host: '191.101.230.103',
//     user: 'u528477660_mypdf',
//     password: '6TsoYqL5/7g^1>>#',
//     database: 'u528477660_mypdf',
// });

export const conn = createPool({
    connectionLimit: 10,
    host: '10.33.4.47',
    user: 'saifa',
    password: 'password12356',
    database: 'db_saifa',
});