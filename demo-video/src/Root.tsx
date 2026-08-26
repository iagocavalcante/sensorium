import { Composition, Still } from "remotion";
import { SensoriumDemo, SensoriumThumbnail } from "./SensoriumDemo";

export const RemotionRoot = () => (
  <>
    <Composition
      id="SensoriumDemo"
      component={SensoriumDemo}
      durationInFrames={4380}
      fps={30}
      width={1920}
      height={1080}
    />
    <Still
      id="SensoriumThumbnail"
      component={SensoriumThumbnail}
      width={1280}
      height={720}
    />
  </>
);
