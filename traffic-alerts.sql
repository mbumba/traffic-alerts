/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;

--
-- Structure of table `alerts`
--

CREATE TABLE IF NOT EXISTS `alerts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `facebook_id` bigint(20) DEFAULT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `icon` enum('1','2','3','4','5') NOT NULL DEFAULT '1',
  `path` varchar(250) NOT NULL,
  `note` varchar(250) DEFAULT NULL,
  `published` datetime NOT NULL,
  `expire_on` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=10 ;
