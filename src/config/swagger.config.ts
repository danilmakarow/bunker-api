import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Mounts Swagger UI at /docs with cookie-based auth metadata.
 * Useful for poking endpoints during M1; full auth flow still requires a real
 * Google login, but the docs surface payload shapes for the FE team.
 */
export const initializeSwagger = (app: INestApplication) => {
  const config = new DocumentBuilder()
    .setTitle('Bunker API')
    .setDescription('Backend for the Bunker / Shelter party game.')
    .setVersion('0.1')
    .addCookieAuth(
      'bunker_session',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'bunker_session',
        description: 'HttpOnly session cookie issued after Google OAuth.',
      },
      'session-cookie',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Bunker API Swagger',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
};
