module.exports = function (sequelize, DataTypes) {
  const UserNotification = sequelize.define(
    "UserNotification",
    {
      user_notification_id: {
        autoIncrement: true,
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: "general",
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reference_type: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      reference_id: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      read_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      read_by: {
        type: DataTypes.STRING(100),
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
      tableName: "user_notification",
      timestamps: false,
    },
  );

  return UserNotification;
};
