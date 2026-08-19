"use strict";

module.exports = function (sequelize, DataTypes) {
  const ProjectDocument = sequelize.define(
    "ProjectDocument",
    {
      project_document_id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        allowNull: false,
        primaryKey: true,
      },
      organization_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Project",
          key: "project_id",
        },
      },

      doc_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      version: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      author: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      language: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      source: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "UPLOAD",
      },

      storage_file_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      storage_file_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      original_filename: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      stored_filename: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      mime_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      file_size: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },

      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "UPLOADED",
      },
      parse_status_detail: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      chunk_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      page_count: {
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
      tableName: "project_document",
      timestamps: true,
      createdAt: "created_date",
      updatedAt: "modified_date",
      deletedAt: "deleted_date",
    }
  );

  return ProjectDocument;
};
