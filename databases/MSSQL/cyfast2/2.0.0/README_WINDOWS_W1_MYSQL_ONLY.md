# Windows Connect W1 is MySQL-only

Windows Connect W1 persistence is currently supported only with MySQL.

Do not run the MySQL W1 migration against SQL Server: it uses MySQL-specific
JSON, `ENUM`, and `AUTO_INCREMENT` syntax. A reviewed SQL Server-equivalent
migration must be supplied before enabling W1 with
`DATABASE_TYPE_PRIMARY=mssql`.
