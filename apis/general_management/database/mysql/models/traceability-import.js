const Sequelize = require("sequelize");

module.exports = function (sequelize, DataTypes) {
  return sequelize.define(
    "TraceabilityImport",
    {
      traceability_import_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      import_type: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      format: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      file_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      file_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      temp_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      document_no: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      document_name: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      author: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      purpose: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      version: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      total_records: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      records_imported: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      created_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      created_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      modified_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      modified_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deleted_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      deleted_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "traceability_import",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );
};
