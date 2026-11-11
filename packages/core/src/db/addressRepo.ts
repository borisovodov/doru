import type { DatabaseSync } from 'node:sqlite';
import type { AddressRecord } from '../model/types';

/** Addresses: line rows plus the city/state/postal/country pieces. */
export class AddressRepo {
  constructor(private readonly db: DatabaseSync) {}

  insertAddress(address: AddressRecord): void {
    this.db
      .prepare('INSERT INTO address (id, city, state, postal_code, country) VALUES (?, ?, ?, ?, ?)')
      .run(address.id, address.city ?? null, address.state ?? null, address.postalCode ?? null, address.country ?? null);
    this.replaceLines(address);
  }

  updateAddress(address: AddressRecord): void {
    this.db
      .prepare('UPDATE address SET city = ?, state = ?, postal_code = ?, country = ? WHERE id = ?')
      .run(address.city ?? null, address.state ?? null, address.postalCode ?? null, address.country ?? null, address.id);
    this.replaceLines(address);
  }

  getAddress(id: string): AddressRecord | undefined {
    const row = this.db
      .prepare('SELECT id, city, state, postal_code, country FROM address WHERE id = ?')
      .get(id) as { id: string; city: string | null; state: string | null; postal_code: string | null; country: string | null } | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  listAddresses(): AddressRecord[] {
    const rows = this.db
      .prepare('SELECT id, city, state, postal_code, country FROM address ORDER BY id')
      .all() as unknown as {
      id: string;
      city: string | null;
      state: string | null;
      postal_code: string | null;
      country: string | null;
    }[];
    return rows.map((row) => this.hydrate(row));
  }

  deleteAddress(id: string): boolean {
    return this.db.prepare('DELETE FROM address WHERE id = ?').run(id).changes > 0;
  }

  private replaceLines(address: AddressRecord): void {
    this.db.prepare('DELETE FROM address_line WHERE address_id = ?').run(address.id);
    const insert = this.db.prepare('INSERT INTO address_line (id, address_id, position, value) VALUES (?, ?, ?, ?)');
    address.lines.forEach((value, position) => {
      insert.run(crypto.randomUUID(), address.id, position, value);
    });
  }

  private hydrate(row: {
    id: string;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  }): AddressRecord {
    const lines = this.db
      .prepare('SELECT value FROM address_line WHERE address_id = ? ORDER BY position')
      .all(row.id) as unknown as { value: string }[];
    const address: AddressRecord = { id: row.id, lines: lines.map((line) => line.value) };
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
