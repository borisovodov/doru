import type { DatabaseSync } from 'node:sqlite';
import type { AddressRecord } from '../model/types';

/** Addresses: line rows plus the city/state/postal/country pieces. */
export class AddressRepo {
  constructor(private readonly db: DatabaseSync) {}

  insertAddress(address: AddressRecord): void {
    this.db
      .prepare(
        'INSERT INTO address (id, city, state, postal_code, country, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        address.id,
        address.city ?? null,
        address.state ?? null,
        address.postalCode ?? null,
        address.country ?? null,
        address.createdAt ?? null,
        address.updatedAt ?? null,
      );
    this.replaceLines(address);
  }

  updateAddress(address: AddressRecord): void {
    if (this.db.prepare('SELECT 1 FROM address WHERE id = ?').get(address.id) === undefined) {
      throw new Error(`address ${address.id} no longer exists`);
    }
    this.db
      .prepare(
        'UPDATE address SET city = ?, state = ?, postal_code = ?, country = ?, created_at = ?, updated_at = ? WHERE id = ?',
      )
      .run(
        address.city ?? null,
        address.state ?? null,
        address.postalCode ?? null,
        address.country ?? null,
        address.createdAt ?? null,
        address.updatedAt ?? null,
        address.id,
      );
    this.replaceLines(address);
  }

  getAddress(id: string): AddressRecord | undefined {
    const row = this.db
      .prepare('SELECT id, city, state, postal_code, country, created_at, updated_at FROM address WHERE id = ?')
      .get(id) as
      | {
          id: string;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          country: string | null;
          created_at: number | null;
          updated_at: number | null;
        }
      | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  listAddresses(): AddressRecord[] {
    const rows = this.db
      .prepare('SELECT id, city, state, postal_code, country, created_at, updated_at FROM address ORDER BY id')
      .all() as unknown as {
      id: string;
      city: string | null;
      state: string | null;
      postal_code: string | null;
      country: string | null;
      created_at: number | null;
      updated_at: number | null;
    }[];
    return rows.map((row) => this.hydrate(row));
  }

  deleteAddress(id: string): boolean {
    return this.db.prepare('DELETE FROM address WHERE id = ?').run(id).changes > 0;
  }

  private replaceLines(address: AddressRecord): void {
    this.db.prepare('DELETE FROM address_line WHERE address_id = ?').run(address.id);
    const insert = this.db.prepare('INSERT INTO address_line (id, address_id, position, value) VALUES (?, ?, ?, ?)');
    address.lines.forEach((line, position) => {
      insert.run(line.id, address.id, position, line.value);
    });
  }

  private hydrate(row: {
    id: string;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    created_at: number | null;
    updated_at: number | null;
  }): AddressRecord {
    const lines = this.db
      .prepare('SELECT id, value FROM address_line WHERE address_id = ? ORDER BY position')
      .all(row.id) as unknown as { id: string; value: string }[];
    const address: AddressRecord = {
      id: row.id,
      lines: lines.map((line) => ({ id: line.id, value: line.value })),
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    };
    if (row.city !== null) {
      address.city = row.city;
    }
    if (row.state !== null) {
      address.state = row.state;
    }
    if (row.postal_code !== null) {
      address.postalCode = row.postal_code;
    }
    if (row.country !== null) {
      address.country = row.country;
    }
    return address;
  }
}
