const serializeError = (error) => {
  if (!error || typeof error !== 'object') {
    return { message: String(error) };
  }

  const serialized = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  for (const [key, value] of Object.entries(error)) {
    if (!(key in serialized)) {
      serialized[key] = value;
    }
  }

  return serialized;
};

export const reportErrorToRemote = async ({ error }) => {
  if (
    !process.env.EXPO_PUBLIC_LOGS_ENDPOINT ||
    !process.env.EXPO_PUBLIC_PROJECT_GROUP_ID ||
    !process.env.EXPO_PUBLIC_CREATE_TEMP_API_KEY
  ) {
    return { success: false };
  }
  try {
    await fetch(process.env.EXPO_PUBLIC_LOGS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_CREATE_TEMP_API_KEY}`,
      },
      body: JSON.stringify({
        projectGroupId: process.env.EXPO_PUBLIC_PROJECT_GROUP_ID,
        logs: [
          {
            message: JSON.stringify(serializeError(error)),
            timestamp: new Date().toISOString(),
            level: 'error',
            source: 'BUILDER',
            devServerId: process.env.EXPO_PUBLIC_DEV_SERVER_ID,
          },
        ],
      }),
    });
  } catch (fetchError) {
    return { success: false, error: fetchError };
  }
  return { success: true };
};
