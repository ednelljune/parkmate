import { pool } from '../../../../db/client.js';

const MISSING_DATABASE_URL_ERROR =
  'No database connection string was provided. Set DATABASE_URL or DATABASE_POOLER_URL.';

function buildQuery(strings, values) {
  let text = '';
  const params = [];

  for (let index = 0; index < strings.length; index += 1) {
    text += strings[index];

    if (index < values.length) {
      params.push(values[index]);
      text += `$${params.length}`;
    }
  }

  return {
    text,
    params,
  };
}

async function executeQuery(client, text, params = []) {
  const result = await client.query(text, params);
  return result.rows;
}

const NullishQueryFunction = () => {
  throw new Error(MISSING_DATABASE_URL_ERROR);
};

NullishQueryFunction.transaction = () => {
  throw new Error(MISSING_DATABASE_URL_ERROR);
};

const sql = pool
  ? async (queryOrStrings, ...values) => {
      if (Array.isArray(queryOrStrings) && Object.prototype.hasOwnProperty.call(queryOrStrings, 'raw')) {
        const { text, params } = buildQuery(queryOrStrings, values);
        return executeQuery(pool, text, params);
      }

      return executeQuery(pool, queryOrStrings, values[0] ?? []);
    }
  : NullishQueryFunction;

if (pool) {
  sql.transaction = async (callback) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const txn = (queryOrStrings, ...values) => {
        if (Array.isArray(queryOrStrings) && Object.prototype.hasOwnProperty.call(queryOrStrings, 'raw')) {
          const { text, params } = buildQuery(queryOrStrings, values);
          return executeQuery(client, text, params);
        }

        return executeQuery(client, queryOrStrings, values[0] ?? []);
      };

      const operations = await callback(txn);
      const results = Array.isArray(operations)
        ? await Promise.all(operations)
        : await operations;

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
}

export default sql;
